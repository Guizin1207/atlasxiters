/**
 * Sessão admin: senha mestra mantida em sessionStorage (não localStorage,
 * pra exigir nova autenticação ao fechar a aba).
 * NUNCA usada para autorização no cliente — toda RPC revalida no servidor.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/request-timeout";
import { beginAdminSession, endAdminSession, touchAdminSession } from "@/lib/admin-devices";

const SESSION_KEY = "atlas_vip_admin_pwd";

type Ctx = {
  password: string | null;
  loading: boolean;
  deviceRegistryError: boolean;
  recognize: (pwd: string) => Promise<boolean>;
  signIn: (pwd: string) => Promise<boolean>;
  signOut: () => void;
};

const AdminContext = createContext<Ctx | null>(null);

async function checkAdmin(password: string): Promise<boolean> {
  const { data, error } = await withTimeout(supabase.rpc("_check_admin", {
    _password: password,
  }));
  // Uma falha de RPC não confirma que a senha está errada.
  if (error || typeof data !== "boolean") throw new Error("admin_validation_unavailable");
  return data;
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceRegistryError, setDeviceRegistryError] = useState(false);

  useEffect(() => {
    if (!password) return;
    let live = true;
    let busy = false;
    const touch = async () => {
      if (busy) return;
      busy = true;
      try { await touchAdminSession(password); if (live) setDeviceRegistryError(false); }
      catch { if (live) setDeviceRegistryError(true); }
      finally { busy = false; }
    };
    void touch();
    const timer = window.setInterval(() => { if (!document.hidden) void touch(); }, 60_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [password]);

  // Restaura sessão e revalida no servidor
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        if (await checkAdmin(stored)) setPassword(stored);
        else sessionStorage.removeItem(SESSION_KEY);
      } catch { /* O usuário pode tentar o login novamente quando a conexão voltar. */ }
      finally { setLoading(false); }
    })();
  }, []);

  const validatedCredential = useCallback(async (pwd: string): Promise<string | null> => {
    const entered = pwd.trim();
    if (!entered) return null;
    // O formulário antigo convertia tudo para maiúsculas antes de validar.
    // Preserve senhas com caixa própria; tente o formato antigo somente se
    // o servidor rejeitar explicitamente o texto original.
    const candidates = [...new Set([entered, entered.toUpperCase()])];
    for (const candidate of candidates) {
      if (!await checkAdmin(candidate)) continue;
      return candidate;
    }
    return null;
  }, []);

  // Reconhecer a entrada não abre sessão nem concede acesso administrativo.
  const recognize = useCallback(async (pwd: string) => Boolean(await validatedCredential(pwd)), [validatedCredential]);

  const signIn = useCallback(async (pwd: string) => {
    const candidate = await validatedCredential(pwd);
    if (!candidate) return false;
    // As próximas RPCs precisam usar exatamente a credencial aceita.
    sessionStorage.setItem(SESSION_KEY, candidate);
    beginAdminSession();
    setPassword(candidate);
    return true;
  }, [validatedCredential]);

  const signOut = useCallback(() => {
    if (password) void endAdminSession(password).catch(() => {});
    sessionStorage.removeItem(SESSION_KEY);
    setPassword(null);
  }, [password]);

  const value = useMemo<Ctx>(
    () => ({ password, loading, deviceRegistryError, recognize, signIn, signOut }),
    [password, loading, deviceRegistryError, recognize, signIn, signOut]
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}
