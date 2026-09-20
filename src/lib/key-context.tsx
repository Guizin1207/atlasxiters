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
const ADMIN_PREVIEW_KEY = "atlas_admin_panel_preview";
const ADMIN_PASSWORD_KEY = "atlas_vip_admin_pwd";

const KeyContext = createContext<Ctx | null>(null);

export function detectDevice(): string {
  if (typeof navigator === "undefined") return "Desconhecido";
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const touchPoints = navigator.maxTouchPoints || 0;
  if (/android/i.test(ua)) return "Android";
  // iPads recentes podem se apresentar como Mac quando o navegador está em modo desktop.
  if (/iphone|ipad|ipod/i.test(ua) || (/mac/i.test(platform) && touchPoints > 1))
    return "iOS";
  if (/windows phone/i.test(ua)) return "Windows";
  if (/cros/i.test(ua)) return "Linux";
  if (/windows/i.test(ua) || /win/i.test(platform)) return "Windows";
  if (/macintosh|mac os x/i.test(ua)) return "Mac";
  if (/linux/i.test(ua)) return "Linux";
  return "Desconhecido";
}

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
  const [loading, setLoading] = useState(true);
  const [adminPreview, setAdminPreview] = useState(
    () => sessionStorage.getItem(ADMIN_PREVIEW_KEY) === "true"
  );
  const deviceRef = useRef<string>(detectDevice());
  const deviceIdRef = useRef<string>(getOrCreateDeviceId());

  const persist = (data: KeyData | null) => {
    if (data) localStorage.setItem(STORAGE_KEY, data.key);
    else localStorage.removeItem(STORAGE_KEY);
    setKeyData(data);
  };

  const refresh = useCallback(async () => {
    const previewPassword = sessionStorage.getItem(ADMIN_PASSWORD_KEY);
    if (sessionStorage.getItem(ADMIN_PREVIEW_KEY) === "true" && previewPassword) {
      const { data, error } = await supabase.rpc("admin_open_panel", {
        _password: previewPassword,
      });
      if (!error && data) {
        setKeyData(data as unknown as KeyData);
        setAdminPreview(true);
        setLoading(false);
        return;
      }
      sessionStorage.removeItem(ADMIN_PREVIEW_KEY);
      setAdminPreview(false);
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setKeyData(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc("validate_key", {
        _key: stored,
        _device_id: deviceIdRef.current,
      });
      if (error) {
        const reason = parseError(error.message);
        if (reason === "expired_key") sessionStorage.setItem(AUTH_ERROR_KEY, reason);
        // chave inválida/expirada/device errado → limpa
        localStorage.removeItem(STORAGE_KEY);
        setKeyData(null);
      } else {
        setKeyData(data as unknown as KeyData);
      }
    } catch {
      // erro de rede: mantém a chave em memória mas sem dados
      setKeyData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const clearLoginOnExit = () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(DEVICE_ID_KEY);
    };

    window.addEventListener("pagehide", clearLoginOnExit);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") clearLoginOnExit();
    });

    return () => {
      window.removeEventListener("pagehide", clearLoginOnExit);
    };
  }, [refresh]);

  const redeem = useCallback<Ctx["redeem"]>(async (rawKey) => {
    const key = rawKey.trim().toUpperCase();
    if (!key) return { ok: false, error: "invalid_key" };
    try {
      const { data, error } = await supabase.rpc("redeem_key", {
        _key: key,
        _device: deviceRef.current,
        _device_id: deviceIdRef.current,
      });
      if (error) {
        const reason = parseError(error.message);
        if (reason === "expired_key") sessionStorage.setItem(AUTH_ERROR_KEY, reason);
        return { ok: false, error: reason };
      }
      sessionStorage.removeItem(AUTH_ERROR_KEY);
      persist(data as unknown as KeyData);
      return { ok: true };
    } catch {
      return { ok: false, error: "network_error" };
    }
  }, []);

  const openAdminPanel = useCallback<Ctx["openAdminPanel"]>(async (password) => {
    const { data, error } = await supabase.rpc("admin_open_panel", {
      _password: password,
    });
    if (error || !data) return false;
    sessionStorage.setItem(ADMIN_PREVIEW_KEY, "true");
    setAdminPreview(true);
    setKeyData(data as unknown as KeyData);
    return true;
  }, []);

  const closeAdminPanel = useCallback(() => {
    sessionStorage.removeItem(ADMIN_PREVIEW_KEY);
    setAdminPreview(false);
    setKeyData(null);
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(ADMIN_PREVIEW_KEY);
    setAdminPreview(false);
    persist(null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      keyData,
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
    [keyData, loading, adminPreview, redeem, openAdminPanel, closeAdminPanel, signOut, refresh]
  );

  return <KeyContext.Provider value={value}>{children}</KeyContext.Provider>;
}

export function useKey() {
  const ctx = useContext(KeyContext);
  if (!ctx) throw new Error("useKey must be used inside <KeyProvider>");
  return ctx;
}
