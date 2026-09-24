import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Profile = { id: string; full_name: string };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function message(error: unknown) {
  const text = error instanceof Error ? error.message : String(error ?? "");
  const lower = text.toLowerCase();
  if (lower.includes("invalid login credentials")) return "Usuário ou senha incorretos.";
  if (lower.includes("invalid_username") || lower.includes("username")) return "Usuário ou senha incorretos.";
  if (lower.includes("rate limit")) return "Muitas tentativas. Aguarde alguns segundos e tente novamente.";
  return text || "Não foi possível concluir a operação.";
}

async function resolveLoginUsername(username: string) {
  const { data, error } = await supabase.rpc("get_login_email_by_username", {
    _username: username.trim(),
  });
  if (error || !data) return null;
  return String(data).trim() || null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("id, full_name").eq("id", userId).maybeSingle();
    setProfile(data ?? null);
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (data.session?.user?.is_anonymous) {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
      } else {
        setSession(data.session);
        if (data.session?.user) void loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      if (next?.user?.is_anonymous) {
        void supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setSession(next);
      if (next?.user) setTimeout(() => { if (mounted) void loadProfile(next.user.id); }, 0);
      else setProfile(null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signIn: async (username, password) => {
      const identifier = username.trim();
      if (!identifier || !password) return { error: "Informe seu usuário e senha." };

      try {
        const loginEmail = await resolveLoginUsername(identifier);
        if (!loginEmail) return { error: "Usuário ou senha incorretos." };

        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });
        return { error: error ? message(error) : null };
      } catch {
        return { error: "Não foi possível conectar ao servidor. Tente novamente." };
      }
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
    },
    refreshProfile: async () => {
      if (session?.user) await loadProfile(session.user.id);
    },
  }), [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
