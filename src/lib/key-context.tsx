/**
 * Atlas VIP — KeyContext
 * Gerencia o ciclo de vida da chave de acesso:
 *   - device_id persistido em localStorage
 *   - detecção de OS via userAgent
 *   - redeem / validate / signOut
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { detectDevice } from "@/lib/device";
import { notifyExpired, resetExpiryNotification, retireOtherUserPush, notifySecurity } from "@/lib/push";
import { withTimeout } from "@/lib/request-timeout";

export { detectDevice } from "@/lib/device";

export type KeyData = {
  id: string;
  key: string;
  duration_days: number;
  device: string | null;
  device_id: string | null;
  activated_at: string | null;
  expires_at: string | null;
  note: string | null;
  is_master: boolean;
  revoked: boolean;
  created_at: string;
  plan?: string | null;
  customer_name?: string | null;
};

type RedeemError =
  | "invalid_key"
  | "revoked_key"
  | "expired_key"
  | "device_mismatch"
  | "network_error"
  | "unknown_error";

type Ctx = {
  keyData: KeyData | null;
  /** Somente para aviso/atendimento: nunca autoriza o painel. */
  expiredKey: string | null;
  loading: boolean;
  device: string;
  deviceId: string;
  adminPreview: boolean;
  redeem: (key: string) => Promise<{ ok: true } | { ok: false; error: RedeemError }>;
  openAdminPanel: (password: string) => Promise<boolean>;
  closeAdminPanel: () => void;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const STORAGE_KEY = "atlas_vip_key";
const DEVICE_ID_KEY = "atlas_vip_device_id";
export const AUTH_ERROR_KEY = "atlas_vip_auth_error";
export const AUTH_SUPPORT_KEY = "atlas_vip_support_key";
const ADMIN_PREVIEW_KEY = "atlas_admin_panel_preview";
const ADMIN_PASSWORD_KEY = "atlas_vip_admin_pwd";

const KeyContext = createContext<Ctx | null>(null);

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function parseError(msg: string | undefined): RedeemError {
  if (!msg) return "unknown_error";
  const m = msg.toLowerCase();
  if (m.includes("invalid_key")) return "invalid_key";
  if (m.includes("revoked_key")) return "revoked_key";
  if (m.includes("expired_key")) return "expired_key";
  if (m.includes("device_mismatch")) return "device_mismatch";
  return "unknown_error";
}

export function KeyProvider({ children }: { children: React.ReactNode }) {
  const [keyData, setKeyData] = useState<KeyData | null>(null);
  const [expiredKey, setExpiredKey] = useState<string | null>(() =>
    sessionStorage.getItem(AUTH_ERROR_KEY) === "expired_key"
      ? sessionStorage.getItem(AUTH_SUPPORT_KEY)
      : null
  );
  const [loading, setLoading] = useState(true);
  const [adminPreview, setAdminPreview] = useState(
    () => sessionStorage.getItem(ADMIN_PREVIEW_KEY) === "true"
  );
  const deviceRef = useRef<string>(detectDevice());
  const deviceIdRef = useRef<string>(getOrCreateDeviceId());
  const requestVersion = useRef(0);
  const changingKey = useRef(false);
  const invalidateRequests = useCallback(() => { requestVersion.current++; }, []);

  const clearExpiry = useCallback(() => {
    sessionStorage.removeItem(AUTH_ERROR_KEY);
    sessionStorage.removeItem(AUTH_SUPPORT_KEY);
    setExpiredKey(null);
  }, []);

  const expireKey = useCallback((key: string) => {
    sessionStorage.setItem(AUTH_ERROR_KEY, "expired_key");
    sessionStorage.setItem(AUTH_SUPPORT_KEY, key);
    setExpiredKey(key);
    setKeyData(null);
  }, []);

  const persist = (data: KeyData | null) => {
    if (data) localStorage.setItem(STORAGE_KEY, data.key);
    else localStorage.removeItem(STORAGE_KEY);
    setKeyData(data);
  };

  const refresh = useCallback(async () => {
    if (changingKey.current) return;
    const version = ++requestVersion.current;
    try {
      const previewPassword = sessionStorage.getItem(ADMIN_PASSWORD_KEY);
      if (sessionStorage.getItem(ADMIN_PREVIEW_KEY) === "true" && previewPassword) {
        const { data, error } = await withTimeout(supabase.rpc("admin_open_panel", {
          _password: previewPassword,
        }));
        if (version !== requestVersion.current) return;
        if (!error && data) {
          clearExpiry();
          setKeyData(data as unknown as KeyData);
          setAdminPreview(true);
          setLoading(false);
          return;
        }
        sessionStorage.removeItem(ADMIN_PREVIEW_KEY);
        setAdminPreview(false);
      }
      const stored = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(AUTH_SUPPORT_KEY);
      if (!stored) {
        setKeyData(null);
        setLoading(false);
        return;
      }
      const { data, error } = await withTimeout(supabase.rpc("validate_key", {
        _key: stored,
        _device_id: deviceIdRef.current,
      }));
      if (version !== requestVersion.current) return;
      if (error) {
        const reason = parseError(error.message);
        if (["invalid_key", "revoked_key", "device_mismatch"].includes(reason)) {
          void (async () => {
            const { data: eventId } = await supabase.rpc("record_security_event", {
              _key: stored,
              _device_id: deviceIdRef.current,
              _device: deviceRef.current,
              _reason: reason,
            });
            if (eventId) void notifySecurity(String(eventId));
          })();
        }
        if (reason === "expired_key") {
          expireKey(stored);
          void notifyExpired(stored);
        } else if (["invalid_key", "revoked_key", "device_mismatch"].includes(reason)) {
          localStorage.removeItem(STORAGE_KEY);
          clearExpiry();
          setKeyData(null);
        }
        // Falha de rede não é expiração e não apaga a identidade do aparelho.
      } else if (data) {
        await retireOtherUserPush(stored);
        if (version !== requestVersion.current) return;
        clearExpiry();
        resetExpiryNotification(stored);
        localStorage.setItem(STORAGE_KEY, stored);
        setKeyData(data as unknown as KeyData);
      }
    } catch {
      // A expiração local continua bloqueando o acesso mesmo sem rede.
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [clearExpiry, expireKey]);

  useEffect(() => {
    void refresh();
    return invalidateRequests;
  }, [refresh, invalidateRequests]);

  // Uma única validação por intervalo, independente da identidade do objeto keyData.
  const currentKey = keyData?.key ?? expiredKey;
  useEffect(() => {
    if (!currentKey || adminPreview) return;
    const recheck = () => { if (document.visibilityState !== "hidden") void refresh(); };
    const timer = window.setInterval(recheck, 15_000);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [currentKey, adminPreview, refresh]);

  const deadline = keyData?.is_master ? null : keyData?.expires_at;
  useEffect(() => {
    if (!currentKey || !deadline || adminPreview) return;
    const remaining = Date.parse(deadline) - Date.now();
    if (!Number.isFinite(remaining)) return;
    const timer = window.setTimeout(() => {
      if (Date.parse(deadline) <= Date.now()) expireKey(currentKey);
      void refresh();
    // Se o relógio do aparelho estiver adiantado, uma validação aceita pelo servidor
    // não pode disparar um ciclo infinito de validações imediatas.
    }, Math.min(remaining > 0 ? remaining : 15_000, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [currentKey, deadline, adminPreview, expireKey, refresh]);

  const redeem = useCallback<Ctx["redeem"]>(async (rawKey) => {
    const key = rawKey.trim().toUpperCase();
    if (!key) return { ok: false, error: "invalid_key" };
    const version = ++requestVersion.current;
    changingKey.current = true;
    try {
      const { data, error } = await withTimeout(supabase.rpc("redeem_key", {
        _key: key,
        _device: deviceRef.current,
        _device_id: deviceIdRef.current,
      }));
      if (version !== requestVersion.current) return { ok: false, error: "network_error" };
      if (error) {
        const reason = parseError(error.message);
        if (["invalid_key", "revoked_key", "device_mismatch"].includes(reason)) {
          void (async () => {
            const { data: eventId } = await supabase.rpc("record_security_event", {
              _key: key,
              _device_id: deviceIdRef.current,
              _device: deviceRef.current,
              _reason: reason,
            });
            if (eventId) void notifySecurity(String(eventId));
          })();
        }
        if (reason === "expired_key") {
          localStorage.removeItem(STORAGE_KEY);
          expireKey(key);
          void notifyExpired(key);
        }
        return { ok: false, error: reason };
      }
      await retireOtherUserPush(key);
      if (version !== requestVersion.current) return { ok: false, error: "network_error" };
      clearExpiry();
      resetExpiryNotification(key);
      sessionStorage.removeItem(ADMIN_PREVIEW_KEY);
      setAdminPreview(false);
      persist(data as unknown as KeyData);
      return { ok: true };
    } catch {
      return { ok: false, error: "network_error" };
    } finally {
      changingKey.current = false;
      if (version === requestVersion.current) setLoading(false);
    }
  }, [clearExpiry, expireKey]);

  const openAdminPanel = useCallback<Ctx["openAdminPanel"]>(async (password) => {
    const version = ++requestVersion.current;
    const { data, error } = await supabase.rpc("admin_open_panel", {
      _password: password,
    });
    if (version !== requestVersion.current || error || !data) return false;
    clearExpiry();
    sessionStorage.setItem(ADMIN_PREVIEW_KEY, "true");
    setAdminPreview(true);
    setKeyData(data as unknown as KeyData);
    return true;
  }, [clearExpiry]);

  const closeAdminPanel = useCallback(() => {
    requestVersion.current++;
    sessionStorage.removeItem(ADMIN_PREVIEW_KEY);
    setAdminPreview(false);
    setKeyData(null);
  }, []);

  const signOut = useCallback(() => {
    requestVersion.current++;
    setLoading(false);
    clearExpiry();
    sessionStorage.removeItem(ADMIN_PREVIEW_KEY);
    setAdminPreview(false);
    persist(null);
  }, [clearExpiry]);

  const value = useMemo<Ctx>(
    () => ({
      keyData,
      expiredKey,
      loading,
      device: deviceRef.current,
      deviceId: deviceIdRef.current,
      adminPreview,
      redeem,
      openAdminPanel,
      closeAdminPanel,
      signOut,
      refresh,
    }),
    [keyData, expiredKey, loading, adminPreview, redeem, openAdminPanel, closeAdminPanel, signOut, refresh]
  );

  return <KeyContext.Provider value={value}>{children}</KeyContext.Provider>;
}

export function useKey() {
  const ctx = useContext(KeyContext);
  if (!ctx) throw new Error("useKey must be used inside <KeyProvider>");
  return ctx;
}
