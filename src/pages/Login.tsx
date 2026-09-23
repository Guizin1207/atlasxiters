import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, KeyRound, ShieldCheck, MessageCircle, Mail, Lock, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKey } from "@/lib/key-context";
import { useAuth } from "@/lib/auth-context";
import { useAdmin } from "@/lib/admin-context";
import { SupportChat } from "@/components/atlas/SupportChat";
import { NotificationBell } from "@/components/atlas/NotificationBell";
import { supabase } from "@/integrations/supabase/client";

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
  anonymous_signins_disabled: "Não foi possível iniciar a sessão com essa key. Verifique a key e tente novamente.",
};

type Mode = "login" | "signup";

export default function LoginPage() {
  const navigate = useNavigate();
  const { keyData, expiredKey, redeem, loading: keyLoading } = useKey();
  const { session, profile, loading: authLoading, signIn, signOut } = useAuth();
  const { recognize, signIn: signInAdmin } = useAdmin();
  const [search] = useSearchParams();
  const switchingUser = search.get("trocar") === "1";
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [keyVerified, setKeyVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [supportOpen, setSupportOpen] = useState(() => new URLSearchParams(window.location.search).get("suporte") === "1");
  const [adminRecognized, setAdminRecognized] = useState(false);
  const [accountStatus, setAccountStatus] = useState<"validating" | "validated" | null>(null);

  useEffect(() => {
    if (!authLoading && !keyLoading && session && keyData && !switchingUser) {
      navigate("/painel", { replace: true });
    }
  }, [authLoading, keyLoading, session, keyData, switchingUser, navigate]);

  const handleAdminPasswordCheck = async () => {
    if (mode !== "login" || !password.trim() || submitting) return;
    try {
      const recognized = await recognize(password);
      setAdminRecognized(recognized);
      if (recognized) setError(null);
    } catch {
      setAdminRecognized(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!password.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const ok = await signInAdmin(password);
      if (ok) navigate("/admin", { replace: true });
      else setError("Senha mestra inválida.");
    } catch {
      setError("Não foi possível validar o acesso administrativo.");
    } finally {
      setSubmitting(false);
    }
  };

  const verifySignupKey = async () => {
    const key = keyValue.trim().toUpperCase();
    if (!key) { setError("Informe sua key de acesso."); return false; }
    setError(null); setInfo(null); setSubmitting(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("validate_key", { _key: key, _device_id: null });
      if (rpcError || !data) {
        const message = rpcError?.message?.toLowerCase() ?? "";
        const code = Object.keys(ERROR_MESSAGES).find(k => message.includes(k));
        setError(ERROR_MESSAGES[code ?? "invalid_key"]);
        setKeyVerified(false);
        return false;
      }
      setKeyVerified(true);
      setInfo("Key válida. Agora preencha seus dados para criar a conta.");
      return true;
    } catch {
      setError(ERROR_MESSAGES.network_error);
      setKeyVerified(false);
      return false;
    } finally { setSubmitting(false); }
  };

  const handleAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === "signup" && !keyVerified) { await verifySignupKey(); return; }
    setSubmitting(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) {
          setError("Informe seu nome.");
          return;
        }
        if (password.length < 8) {
          setError("A senha precisa ter pelo menos 8 caracteres.");
          return;
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
          setError("Use uma senha com 8+ caracteres, incluindo letra maiúscula, minúscula e número.");
          return;
        }
        const internalEmail = `${keyValue.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")}@atlasvip.app`;
        setAccountStatus("validating");
        setInfo("Criando conta e vinculando sua key...");
        
        // O cadastro do Atlas usa uma Edge Function administrativa para criar o
        // usuário já confirmado. Assim, o login não depende de e-mail de confirmação
        // nem da configuração "Confirm email" do projeto Supabase.
        const { data: signupData, error: signupError } = await supabase.functions.invoke("atlas-signup", {
          body: { key: keyValue, name, password },
        });

        if (signupError) {
          setAccountStatus(null);
          let detail = "";
          try {
            const response = (signupError as any)?.context;
            if (response && typeof response.clone === "function") {
              const body = await response.clone().json();
              detail = String(body?.error ?? "");
            }
          } catch {
            detail = "";
          }
          if (!detail) {
            detail = String(signupError.message ?? "");
          }
          const detailMap: Record<string, string> = {
            server_configuration_error: "O serviço de cadastro do Atlas não está configurado corretamente.",
            invalid_request: "Os dados enviados para o cadastro são inválidos.",
            signup_failed: "O Supabase recusou a criação da conta. Tente novamente.",
            database_error: "Não foi possível acessar os dados da key.",
            key_already_linked: ERROR_MESSAGES.key_already_linked,
            invalid_key: ERROR_MESSAGES.invalid_key,
            invalid_username: "O usuário precisa ter entre 2 e 40 caracteres.",
            weak_password: "Use uma senha com 8+ caracteres, incluindo letra maiúscula, minúscula e número.",
            account_already_exists: "Esta conta já foi criada com essa key.",
            profile_creation_failed: "A conta foi criada, mas o perfil não pôde ser salvo. Tente novamente.",
          };
          setError(detailMap[detail] ?? "Não foi possível criar a conta agora. Verifique os dados e tente novamente.");
          return;
        }

        const functionError = String(signupData?.error ?? "");
        if (!signupData?.ok) {
          setAccountStatus(null);
          const messages: Record<string, string> = {
            invalid_key: ERROR_MESSAGES.invalid_key,
            key_already_linked: ERROR_MESSAGES.key_already_linked,
            invalid_username: "O usuário precisa ter entre 2 e 40 caracteres.",
            weak_password: "Use uma senha com 8+ caracteres, incluindo letra maiúscula, minúscula e número.",
            account_already_exists: "Esta conta já foi criada com essa key.",
            signup_failed: "Não foi possível criar a conta. Tente novamente.",
            database_error: "Não foi possível validar a key. Tente novamente.",
          };
          setError(messages[functionError] ?? "Não foi possível criar a conta. Tente novamente.");
          return;
        }

        const loginResult = await signIn(internalEmail, password);
        if (loginResult.error) {
          setAccountStatus(null);
          setError("A conta foi criada, mas o login automático falhou. Entre novamente com seu usuário e senha.");
          return;
        }

        // A Edge Function já vinculou a key à conta durante a criação.
        // Não chame redeem novamente aqui, pois isso tentaria reivindicar
        // uma key que acabou de ser vinculada ao mesmo usuário.
        setAccountStatus("validated");
        await signOut();
        setMode("login");
        setPassword("");
        setKeyVerified(false);
        setInfo("Conta criada e key vinculada com sucesso. Agora entre com seu usuário e senha.");
      } else {
        if (!name.trim()) {
          setError("Informe seu usuário.");
          return;
        }
        const { data: loginEmail, error: lookupError } = await supabase.rpc("get_login_email_by_username", { _username: name.trim() });
        if (lookupError || !loginEmail) {
          setError("Usuário ou senha incorretos.");
          return;
        }
        const result = await signIn(String(loginEmail), password);
        if (result.error) {
          setError(result.error);
          return;
        }

        // Se a sessão entrou mas o KeyProvider ainda não atualizou, tenta
        // vincular/validar a key salva localmente antes de abrir o painel.
        const savedKey = localStorage.getItem("atlas_vip_key");
        if (savedKey) {
          const activated = await redeem(savedKey);
          if (!activated.ok) {
            setError(ERROR_MESSAGES[activated.error] ?? ERROR_MESSAGES.unknown_error);
            return;
          }
        }
        navigate("/painel", { replace: true });
      }
    } finally {
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

            {mode === "signup" && !keyVerified && (
              <div className="space-y-3">
              <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                <p className="vip-eyebrow">1. Key de cadastro</p>
                <p className="text-sm text-muted-foreground mt-1">Use sua key uma única vez para liberar a criação da conta.</p>
              </div>
              <label className="block">
                <span className="vip-eyebrow block mb-2">Key de acesso</span>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={keyValue} onChange={e => { setKeyValue(e.target.value); setKeyVerified(false); setError(null); }} placeholder="ATLS-XXXX-XXXX" autoCapitalize="characters" className="h-12 pl-11 rounded-2xl bg-white/5 border-white/10 font-mono tracking-wider" required />
                </div>
              </label>
              </div>
            )}

{mode === "signup" && keyVerified && (
              <>
                <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                  <p className="vip-eyebrow">2. Conta liberada</p>
                  <p className="font-semibold mt-1">A key foi validada e será vinculada automaticamente a esta conta.</p>
                </div>
                <label className="block">
                  <span className="vip-eyebrow block mb-2">Usuário</span>
                  <div className="relative">
                    <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu usuário" className="h-12 pl-11 rounded-2xl bg-white/5 border-white/10" required />
                  </div>
                </label>
              </>
            )}

                        {mode === "login" && <label className="block">
              <span className="vip-eyebrow block mb-2">Usuário</span>
              <div className="relative">
                <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={name} onChange={e => { setName(e.target.value); setError(null); }} placeholder="Seu usuário" autoComplete="username" className="h-12 pl-11 rounded-2xl bg-white/5 border-white/10" required />
              </div>
            </label>}

            {(mode === "login" || keyVerified) && <label className="block">
              <span className="vip-eyebrow block mb-2">Senha</span>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="password" value={password} onChange={e => { setPassword(e.target.value); setAdminRecognized(false); setError(null); }} onBlur={() => void handleAdminPasswordCheck()} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} className="h-12 pl-11 rounded-2xl bg-white/5 border-white/10" required />
              </div>
            </label>}

            {adminRecognized && mode === "login" && <Button type="button" onClick={handleAdminLogin} disabled={submitting} variant="ghost" className="w-full h-11 rounded-2xl border border-white/10 bg-white/5 font-semibold"><ShieldCheck className="w-4 h-4 mr-2" /> Entrar como ADM</Button>}

            {accountStatus && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3">
                {accountStatus === "validating" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <div>
                  <p className="text-sm font-semibold">{accountStatus === "validating" ? "Validando conta..." : "Conta validada"}</p>
                  <p className="text-xs text-muted-foreground">{accountStatus === "validating" ? "Vinculando sua key e liberando o acesso." : "Acesso liberado com sucesso."}</p>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-status-danger bg-status-danger/10 border border-status-danger/20 rounded-xl px-4 py-3">{error}</p>}
            {info && <p className="text-sm text-muted-foreground bg-white/5 border border-white/10 rounded-xl px-4 py-3">{info}</p>}

            <Button disabled={submitting} className="w-full h-12 rounded-2xl bg-white text-black font-bold">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "login" ? "Entrar" : keyVerified ? "Criar minha conta" : "Validar key e continuar"}
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
