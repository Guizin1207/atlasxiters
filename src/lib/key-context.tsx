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
  redeem: (key: string) => Promise<{ ok: true } | { ok: false; error: RedeemError }>;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const STORAGE_KEY = "atlas_vip_key";
const DEVICE_ID_KEY = "atlas_vip_device_id";

const KeyContext = createContext<Ctx | null>(null);

function detectDevice(): string {
  if (typeof navigator === "undefined") return "Desconhecido";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/macintosh|mac os x/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows";
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
  const deviceRef = useRef<string>(detectDevice());
  const deviceIdRef = useRef<string>(getOrCreateDeviceId());

  const persist = (data: KeyData | null) => {
    if (data) localStorage.setItem(STORAGE_KEY, data.key);
    else localStorage.removeItem(STORAGE_KEY);
    setKeyData(data);
  };

  const refresh = useCallback(async () => {
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
      if (error) return { ok: false, error: parseError(error.message) };
      persist(data as unknown as KeyData);
      return { ok: true };
    } catch {
      return { ok: false, error: "network_error" };
    }
  }, []);

  const signOut = useCallback(() => {
    persist(null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      keyData,
      loading,
      device: deviceRef.current,
      deviceId: deviceIdRef.current,
      redeem,
      signOut,
      refresh,
    }),
    [keyData, loading, redeem, signOut, refresh]
  );

  return <KeyContext.Provider value={value}>{children}</KeyContext.Provider>;
}

export function useKey() {
  const ctx = useContext(KeyContext);
  if (!ctx) throw new Error("useKey must be used inside <KeyProvider>");
  return ctx;
}
