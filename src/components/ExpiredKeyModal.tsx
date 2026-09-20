import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TimerOff, LogOut, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKey } from "@/lib/key-context";
import { SupportChat } from "@/components/atlas/SupportChat";

/**
 * Mostra quando a chave expira/é revogada.
 * Mantém a key disponível para o usuário abrir o atendimento antes de sair.
 */
export function ExpiredKeyModal() {
  const { keyData, signOut } = useKey();
  const navigate = useNavigate();
  const [supportOpen, setSupportOpen] = useState(false);

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
        <Button onClick={() => setSupportOpen(true)} className="w-full h-12 rounded-2xl bg-status-danger/15 text-status-danger border border-status-danger/30 hover:bg-status-danger/20">
          <MessageCircle className="w-4 h-4 mr-2" />
          Falar com o suporte
        </Button>
        <Button
          onClick={exit}
          className="w-full h-12 rounded-2xl bg-white text-black hover:bg-white/90"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Voltar ao login
        </Button>
      </div>

      {supportOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={() => setSupportOpen(false)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => setSupportOpen(false)} className="rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                Fechar
              </button>
            </div>
            <SupportChat accessKey={keyData?.key} />
          </div>
        </div>
      )}
    </div>
  );
}
