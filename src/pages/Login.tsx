import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, KeyRound, ShieldCheck, MessageCircle, TriangleAlert, Mail, Lock, UserRound, Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKey } from "@/lib/key-context";
import { useAdmin } from "@/lib/admin-context";
import { useAuth } from "@/lib/auth-context";
import { SupportChat } from "@/components/atlas/SupportChat";
import { NotificationBell } from "@/components/atlas/NotificationBell";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_key: "Chave inválida. Verifique e tente novamente.",
  revoked_key: "Esta chave foi revogada. Entre em contato com o suporte.",
  expired_key: "Esta chave expirou. Renove para continuar.",
  device_mismatch: "Esta chave já está vinculada a outro dispositivo.",
  key_already_linked: "Esta key já está vinculada a outra conta.",
  account_mismatch: "Esta key pertence a outra conta.",
  login_required: "Entre na sua conta antes de ativar a key.",
  network_error: "Sem conexão. Tente novamente.",
  unknown_error: "Algo deu errado. Tente novamente em instantes.",
};

type Mode = "login" | "signup";

export default function LoginPage() {
  const navigate = useNavigate();
  const { keyData, expiredKey, redeem, loading: keyLoading } = useKey();
  const { recognize, signIn: adminSignIn } = useAdmin();
  const { session, profile, loading: authLoading, signIn, signUp, signInWithGoogle, signOut } = useAuth();
  const [search] = useSearchParams();
  const switchingUser = search.get("trocar") === "1";
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [adminValue, setAdminValue] = useState("");
  const [adminRecognition, setAdminRecognition] = useState<{ value: string; admin: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [supportOpen, setSupportOpen] = useState(() => new URLSearchParams(window.location.search).get("suporte") === "1");

  useEffect(() => {
    if (!authLoading && !keyLoading && session && keyData && !switchingUser) {
      navigate("/painel", { replace: true });
    }
  }, [authLoading, keyLoading, session, keyData, switchingUser, navigate]);

  const adminEntry = Boolean(adminValue.trim()) && adminRecognition?.value === adminValue && adminRecognition.admin;

  useEffect(() => {
    const value = adminValue.trim() ? adminValue : password;
    if (!value.trim()) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const admin = await recognize(value);
        if (!cancelled) setAdminRecognition({ value, admin });
      } catch {
        if (!cancelled) setAdminRecognition({ value, admin: false });
      }
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [adminValue, password, recognize]);

  const enterAdmin = async (value: string) => {
    const ok = await adminSignIn(value);
    if (ok) {
      navigate("/admin", { replace: true });
      return true;
    }
    setError("Acesso administrativo não confirmado.");
    return false;
  };

  const handleAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "login" && password.trim()) {
        const isAdminPassword = adminRecognition?.value === password
          ? adminRecognition.admin
          : await recognize(password).catch(() => false);
        if (isAdminPassword) {
          await enterAdmin(password);
          return;
        }
      }
      if (!email.trim()) {
        setError("Informe seu e-mail.");
        return;
      }
      if (mode === "signup") {
        if (!name.trim()) {
          setError("Informe seu nome.");
          return;
        }
        if (password.length < 6) {
          setError("A senha precisa ter pelo menos 6 caracteres.");
          return;
        }
        const result = await signUp(name, email, password);
        if (result.error) setError(result.error);
        else if (result.needsConfirmation) setInfo("Conta criada. Confirme seu e-mail para entrar.");
        else setInfo("Conta criada. Agora ative sua key.");
      } else {
        const result = await signIn(email, password);
        if (result.error) setError(result.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    const result = await signInWithGoogle();
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    }
  };

  const handleKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || submitting || !keyValue.trim()) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const result = await redeem(keyValue);
      if (result.ok) navigate("/painel", { replace: true });
      else if ("error" in result) setError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown_error);
      else setError(ERROR_MESSAGES.unknown_error);
    } catch {
      setError(ERROR_MESSAGES.unknown_error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEntry || submitting) return;
    setSubmitting(true);
    const ok = await adminSignIn(adminValue);
    setSubmitting(false);
    if (ok) navigate("/admin", { replace: true });
    else setError("Acesso administrativo não confirmado.");
  };

  const isExpired = error === ERROR_MESSAGES.expired_key || Boolean(expiredKey);
  const supportKey = expiredKey || keyValue.trim().toUpperCase();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md animate-fade-in">
        {isExpired && <div className="flex justify-end mb-4"><NotificationBell /></div>}

        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl glass-strong mb-6">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <p className="vip-eyebrow mb-2">Acesso Atlas</p>
          <h1 className="vip-title text-4xl">Atlas VIP</h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-xs mx-auto">
            {session ? "Sua conta está pronta. Ative uma key para liberar o painel." : "Crie sua conta ou entre para continuar."}
          </p>
        </header>

        {!session ? (
          <form onSubmit={handleAccount} className="glass-strong rounded-3xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white/5">
              <button type="button" onClick={() => { setMode("login"); setError(null); }} className={mode === "login" ? "h-10 rounded-xl bg-white text-black text-sm font-bold" : "h-10 rounded-xl text-sm text-muted-foreground"}>Entrar</button>
              <button type="button" onClick={() => { setMode("signup"); setError(null); }} className={mode === "signup" ? "h-10 rounded-xl bg-white text-black text-sm font-bold" : "h-10 rounded-xl text-sm text-muted-foreground"}>Criar conta</button>
            </div>

            {mode === "signup" && (
              <label className="block">
                <span className="vip-eyebrow block mb-2">Nome completo</span>
                <div className="relative">
                  <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className="h-12 pl-11 rounded-2xl bg-white/5 border-white/10" />
                </div>
              </label>
            )}

            <label className="block">
              <span className="vip-eyebrow block mb-2">E-mail</span>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" className="h-12 pl-11 rounded-2xl bg-white/5 border-white/10" required />
              </div>
            </label>

            <label className="block">
              <span className="vip-eyebrow block mb-2">Senha</span>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} className="h-12 pl-11 rounded-2xl bg-white/5 border-white/10" required />
              </div>
            </label>

            {error && <p className="text-sm text-status-danger bg-status-danger/10 border border-status-danger/20 rounded-xl px-4 py-3">{error}</p>}
            {info && <p className="text-sm text-muted-foreground bg-white/5 border border-white/10 rounded-xl px-4 py-3">{info}</p>}

            <Button disabled={submitting} className="w-full h-12 rounded-2xl bg-white text-black font-bold">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "login" ? "Entrar" : "Criar minha conta"}
            </Button>

            <div className="relative py-1">
              <div className="border-t border-white/10" />
              <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 px-3 bg-background text-[10px] text-muted-foreground uppercase">ou</span>
            </div>

            <Button type="button" variant="ghost" onClick={handleGoogle} disabled={submitting} className="w-full h-12 rounded-2xl border border-white/10 bg-white/5">
              <Chrome className="w-4 h-4 mr-2" /> Continuar com Google
            </Button>
          </form>
        ) : !keyData ? (
          <form onSubmit={handleKey} className="glass-strong rounded-3xl p-6 space-y-5">
            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <p className="vip-eyebrow">Conta</p>
              <p className="font-semibold mt-1">{profile?.full_name || session.user.email}</p>
              <p className="text-xs text-muted-foreground mt-1">A key ativada ficará vinculada a esta conta.</p>
            </div>
            <label className="block">
              <span className="vip-eyebrow block mb-3">Key de acesso</span>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={keyValue} onChange={e => { setKeyValue(e.target.value); setError(null); }} placeholder="ATLS-XXXX-XXXX" autoCapitalize="characters" className="h-14 pl-11 rounded-2xl bg-white/5 border-white/10 font-mono tracking-wider" required />
              </div>
            </label>
            {error && <p className="text-sm text-status-danger bg-status-danger/10 border border-status-danger/20 rounded-xl px-4 py-3">{error}</p>}
            <Button disabled={submitting} className="w-full h-14 rounded-2xl bg-white text-black font-bold uppercase tracking-[0.12em]">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ativar key"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void signOut()} className="w-full rounded-2xl text-muted-foreground">Sair da conta</Button>
          </form>
        ) : null}

        {!session && (
          <form onSubmit={handleAdmin} className="mt-5">
            <Input type="password" value={adminValue} onChange={e => { setAdminValue(e.target.value); setAdminRecognition(null); }} placeholder="Acesso administrativo" className="h-10 rounded-xl bg-transparent border-transparent text-center text-[10px] opacity-20 focus:opacity-100" aria-label="Acesso administrativo" />
            {adminEntry && <Button type="submit" disabled={submitting} className="mt-2 w-full h-10 rounded-xl bg-white text-black text-xs">Entrar como ADM</Button>}
          </form>
        )}

        <div className="mt-8 text-center space-y-3">
          <p className="text-xs text-muted-foreground/60">Precisa de ajuda? Fale com o suporte.</p>
          <Button type="button" onClick={() => setSupportOpen(true)} className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-2xl glass-strong bg-transparent text-white text-sm font-semibold">
            <MessageCircle className="w-4 h-4" /> Falar com suporte
          </Button>
        </div>
      </div>

      {supportOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={() => setSupportOpen(false)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="mb-2 flex justify-end"><button type="button" onClick={() => setSupportOpen(false)} className="rounded-full bg-black/70 px-3 py-1 text-xs text-white">Fechar</button></div>
            <SupportChat accessKey={supportKey} />
          </div>
        </div>
      )}
    </main>
  );
}
