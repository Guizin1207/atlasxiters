import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TimerOff, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKey } from "@/lib/key-context";

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
    }, 4000);
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
          <p className="vip-eyebrow mb-2">Sessão</p>
          <h2 id="expired-title" className="vip-title text-2xl">
            Chave expirada
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Sua chave de acesso não é mais válida. Renove para continuar usando o
          painel.
        </p>
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
