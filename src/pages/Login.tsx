/**
 * Tela de login por chave.
 * Aceita upper/lower; auto-formata para maiúsculas; mostra erros amigáveis.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, KeyRound, ShieldCheck, MessageCircle, TriangleAlert } from "lucide-react";
import { SUPPORT_URL, SUPPORT_LABEL } from "@/lib/atlas-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_ERROR_KEY, useKey } from "@/lib/key-context";
import { useAdmin } from "@/lib/admin-context";

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
  const { keyData, redeem, loading } = useKey();
  const { signIn: adminSignIn } = useAdmin();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(() => {
    const reason = sessionStorage.getItem(AUTH_ERROR_KEY);
    sessionStorage.removeItem(AUTH_ERROR_KEY);
    return reason ? ERROR_MESSAGES[reason] ?? null : null;
  });
  const [submitting, setSubmitting] = useState(false);
  const isExpired = error === ERROR_MESSAGES.expired_key;

  useEffect(() => {
    if (!loading && keyData) navigate("/painel", { replace: true });
  }, [keyData, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    // Senha mestra digitada na tela de login abre o painel admin
    const isAdmin = await adminSignIn(value.trim());
    if (isAdmin) {
      setSubmitting(false);
      navigate("/admin", { replace: true });
      return;
    }
    const result = await redeem(value);
    setSubmitting(false);
    if (result.ok === true) {
      navigate("/painel", { replace: true });
      return;
    }
    setError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.unknown_error);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md animate-fade-in">
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
                value={value}
                onChange={(e) => {
                  setValue(e.target.value.toUpperCase());
                  if (error) setError(null);
                }}
                placeholder="XXXX-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={submitting}
                className="h-14 pl-11 pr-4 text-base font-mono tracking-wider rounded-2xl bg-white/5 border-white/10 focus-visible:ring-white/30"
                aria-invalid={!!error}
              />
            </div>
          </label>

          {error && (
            <div
              role="alert"
              className="text-sm text-status-danger bg-status-danger/15 border border-status-danger/30 rounded-xl px-4 py-3"
            >
              <div className="flex items-start gap-2">
                {isExpired && <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  {isExpired && <strong className="block text-base uppercase">Expirado</strong>}
                  <span>{isExpired ? "Seu acesso expirou. Procure o suporte para renovar." : error}</span>
                </div>
              </div>
              {isExpired && (
                <a
                  href={SUPPORT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex h-10 items-center justify-center gap-2 rounded-lg border border-status-danger/30 font-semibold"
                >
                  <MessageCircle className="w-4 h-4" />
                  Falar com o suporte
                </a>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting || !value.trim()}
            className="w-full h-14 rounded-2xl text-base font-bold uppercase tracking-[0.15em] bg-white text-black hover:bg-white/90"
          >
            {submitting ? (
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
            Não tem uma chave? Fale com o suporte para adquirir acesso.
          </p>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-2xl glass-strong text-sm font-semibold hover:bg-white/10 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            {SUPPORT_LABEL}
          </a>
        </div>
      </div>
      <a
        href={SUPPORT_URL}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-2xl ring-1 ring-black/10 transition-transform hover:scale-105 active:scale-95"
        aria-label="Abrir suporte"
      >
        <MessageCircle className="h-5 w-5" />
      </a>
    </main>
  );
}
