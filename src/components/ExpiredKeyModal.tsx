import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TimerOff, LogOut, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKey } from "@/lib/key-context";
import { SUPPORT_URL } from "@/lib/atlas-config";

/**
 * Mostra quando a chave expira/é revogada.
 * Limpa o storage automaticamente após 4s e força redirect para /login.
 */
export function ExpiredKeyModal() {
  const { signOut } = useKey();
  const navigate = useNavigate();

  useEffect(() => {
    const id = setTimeout(() => {
      signOut();
      navigate("/login", { replace: true });
    }, 8000);
    return () => clearTimeout(id);
  }, [signOut, navigate]);

  const exit = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="expired-title"
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center px-6 animate-fade-in"
    >
      <div className="glass-strong rounded-3xl p-8 max-w-md w-full text-center space-y-5">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-status-danger/15 items-center justify-center mx-auto">
          <TimerOff className="w-7 h-7 text-status-danger" />
        </div>
        <div>
          <p className="vip-eyebrow mb-2 text-status-danger">Acesso encerrado</p>
          <h2 id="expired-title" className="vip-title text-3xl text-status-danger">
            Expirado
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Sua chave não é mais válida. Procure o suporte para renovar seu acesso.
        </p>
        <Button asChild className="w-full h-12 rounded-2xl bg-status-danger/15 text-status-danger border border-status-danger/30 hover:bg-status-danger/20">
          <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp +55 38 99881-6357
          </a>
        </Button>
        <Button
          onClick={exit}
          className="w-full h-12 rounded-2xl bg-white text-black hover:bg-white/90"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Voltar ao login
        </Button>
      </div>
    </div>
  );
}
