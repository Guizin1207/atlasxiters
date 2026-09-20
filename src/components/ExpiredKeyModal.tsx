import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TimerOff, LogOut, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKey } from "@/lib/key-context";
import { SupportChat } from "@/components/atlas/SupportChat";

/**
 * Tela de acesso expirado, sem cobrir o sino e sem montar funções do painel.
 */
export function ExpiredKeyModal() {
  const { expiredKey, signOut } = useKey();
  const navigate = useNavigate();
  const [supportOpen, setSupportOpen] = useState(() => new URLSearchParams(window.location.search).get("suporte") === "1");

  const exit = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div
      role="alert"
      aria-labelledby="expired-title"
      className="flex items-center justify-center py-8 animate-fade-in"
    >
      <div className="rounded-3xl border border-status-danger/40 bg-status-danger/10 p-6 max-w-md w-full text-center space-y-5">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-status-danger/15 items-center justify-center mx-auto">
          <TimerOff className="w-7 h-7 text-status-danger" />
        </div>
        <div>
          <p className="vip-eyebrow mb-2 text-status-danger">Acesso encerrado</p>
          <h2 id="expired-title" className="vip-title text-2xl text-status-danger">
            Sua key foi expirada
          </h2>
        </div>
        <p className="text-sm text-status-danger">
          Seu acesso está bloqueado. Fale com o suporte para renovar sua key.
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
            <SupportChat accessKey={expiredKey} />
          </div>
        </div>
      )}
    </div>
  );
}
