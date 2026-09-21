/**
 * Tela de login por chave.
 * Reconhece o acesso ADM no servidor; keys de usuário mantêm seu fluxo próprio.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, KeyRound, ShieldCheck, MessageCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKey } from "@/lib/key-context";
import { useAdmin } from "@/lib/admin-context";
import { SupportChat } from "@/components/atlas/SupportChat";
import { NotificationBell } from "@/components/atlas/NotificationBell";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_key: "Chave inválida. Verifique e tente novamente.",
  revoked_key: "Esta chave foi revogada. Entre em contato com o suporte.",
  expired_key: "Esta chave expirou. Renove para continuar.",
  device_mismatch:
    "Esta chave já está vinculada a outro dispositivo. Solicite um reset ao suporte.",
  network_error: "Sem conexão. Tente novamente.",
  unknown_error: "Algo deu errado. Tente novamente em instantes.",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { keyData, expiredKey, redeem, loading } = useKey();
  const { recognize, signIn } = useAdmin();
  const [search] = useSearchParams();
  const switchingUser = search.get("trocar") === "1";
  const [value, setValue] = useState("");
  const [recognition, setRecognition] = useState<{ value: string; admin: boolean } | null>(null);
  const detecting = Boolean(value.trim()) && recognition?.value !== value;
  const isAdminEntry = Boolean(value.trim()) && recognition?.value === value && recognition.admin;
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [supportOpen, setSupportOpen] = useState(() => new URLSearchParams(window.location.search).get("suporte") === "1");
  const enteredKey = value.trim().toUpperCase();
  const supportKey = isAdminEntry ? "" : expiredKey && (!enteredKey || enteredKey === expiredKey) ? expiredKey : enteredKey;
  const isExpired = error === ERROR_MESSAGES.expired_key || Boolean(expiredKey && supportKey === expiredKey);
  const displayError = error ?? (isExpired ? ERROR_MESSAGES.expired_key : null);

  useEffect(() => {
    if (!loading && keyData && !switchingUser) navigate("/painel", { replace: true });
  }, [keyData, loading, switchingUser, navigate]);

  useEffect(() => {
    if (!value.trim()) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const admin = await recognize(value);
        if (!cancelled) setRecognition({ value, admin });
      } catch {
        if (!cancelled) {
          setRecognition({ value, admin: false });
          setError("Não foi possível verificar o acesso agora. Tente novamente em instantes.");
        }
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [value, recognize]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || detecting || !value.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      if (isAdminEntry) {
        if (await signIn(value)) navigate("/admin", { replace: true });
        else setError("Acesso não confirmado. Confira sua chave e tente novamente.");
        return;
      }
      const result = await redeem(enteredKey);
      if (result.ok === true) navigate("/painel", { replace: true });
      else setError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown_error);
    } catch {
      setError("Não foi possível confirmar seu acesso agora. Tente novamente em instantes.");
    } finally { setSubmitting(false); }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md animate-fade-in">
        {isExpired && <div className="flex justify-end mb-4"><NotificationBell /></div>}
        {/* Brand */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl glass-strong mb-6">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <p className="vip-eyebrow mb-2">Acesso restrito</p>
          <h1 className="vip-title text-4xl">Atlas VIP</h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-xs mx-auto">
            Insira sua chave de ativação para entrar no painel.
          </p>
        </header>

        {/* Form */}
        <form
          onSubmit={onSubmit}
          className="glass-strong rounded-3xl p-6 space-y-5"
          aria-label="Formulário de chave de acesso"
        >
          <label className="block">
            <span className="vip-eyebrow block mb-3">Sua chave</span>
            <div className="relative">
              <KeyRound
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                aria-hidden
              />
              <Input
                type="password"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setRecognition(null);
                  if (error) setError(null);
                }}
                placeholder="XXXX-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={submitting}
                className="h-14 pl-11 pr-4 text-base font-mono tracking-wider rounded-2xl bg-white/5 border-white/10 focus-visible:ring-white/30"
                aria-invalid={!!error}
              />
            </div>
          </label>

          {displayError && (
            <div
              role="alert"
              className="text-sm text-status-danger bg-status-danger/15 border border-status-danger/30 rounded-xl px-4 py-3"
            >
              <div className="flex items-start gap-2">
                {isExpired && <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  {isExpired && <strong className="block text-base">Sua key foi expirada</strong>}
                  <span>{isExpired ? "Seu acesso está bloqueado. Fale com o suporte para renovar." : displayError}</span>
                </div>
              </div>
              {isExpired && (
                <button
                  type="button"
                  onClick={() => setSupportOpen(true)}
                  className="mt-3 flex w-full h-10 items-center justify-center gap-2 rounded-lg border border-status-danger/30 font-semibold"
                >
                  <MessageCircle className="w-4 h-4" />
                  Falar com o suporte
                </button>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || detecting || !value.trim()}
            className="w-full h-14 rounded-2xl text-base font-bold uppercase tracking-[0.15em] bg-white text-black hover:bg-white/90"
          >
            {submitting || detecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validando…
              </>
            ) : (
              "Entrar"
            )}
          </Button>

          <p className="text-[11px] text-center text-muted-foreground/70 pt-2">
            Sua chave fica vinculada a este dispositivo.
          </p>
        </form>

        <div className="mt-8 text-center space-y-3">
          <p className="text-xs text-muted-foreground/60">
            Precisa de ajuda? Fale com o suporte.
          </p>
          <Button
            type="button"
            disabled={detecting}
            onClick={() => setSupportOpen(true)}
            className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-2xl glass-strong bg-transparent text-white text-sm font-semibold hover:bg-white/10 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Falar com suporte
          </Button>
        </div>
      </div>
      {supportOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center"
          onClick={() => setSupportOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="rounded-full bg-black/70 px-3 py-1 text-xs text-white"
              >
                Fechar
              </button>
            </div>
            <SupportChat accessKey={supportKey} />
          </div>
        </div>
      )}
    </main>
  );
}
