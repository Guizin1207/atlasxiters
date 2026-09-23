import { useState } from "react";
import { Rocket, Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { gameLaunchUrl, type GameVariant } from "@/lib/game-launch";

/** O navegador tenta abrir o jogo; não injeta arquivos nem altera o aplicativo. */
export function InjectButton() {
  const fallback = new URLSearchParams(window.location.search).get("game_fallback");
  const [open, setOpen] = useState(fallback === "normal" || fallback === "max");
  const [attempted, setAttempted] = useState(fallback === "normal" || fallback === "max");
  const [loadingGame, setLoadingGame] = useState<GameVariant | null>(null);
  const [loaded, setLoaded] = useState(false);
  return <>
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 px-5 w-full max-w-md">
      <button type="button" onClick={() => { setOpen(true); setLoaded(false); setLoadingGame(null); }} className="w-full h-16 rounded-2xl bg-white text-black font-bold uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 shadow-elevated active:scale-[0.98] transition-transform">
        <Rocket className="w-4 h-4" /> Injetar
      </button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rounded-3xl max-w-sm">
        <DialogHeader><DialogTitle>Escolha o jogo</DialogTitle><DialogDescription>Toque na versão instalada para tentar abrir o jogo.</DialogDescription></DialogHeader>
        {loadingGame ? (
          <div className="py-8 text-center space-y-5">
            <div className="mx-auto w-16 h-16 rounded-2xl glass flex items-center justify-center">
              {loaded ? <CheckCircle2 className="w-8 h-8" /> : <Loader2 className="w-8 h-8 animate-spin" />}
            </div>
            <div>
              <p className="font-bold">{loaded ? "Arquivos carregados" : "Carregando arquivos..."}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {loaded ? "Abrindo o jogo..." : "Preparando os arquivos para iniciar."}
              </p>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full bg-white transition-all duration-[1800ms] ${loaded ? "w-full" : "w-[85%]"}`} />
            </div>
          </div>
        ) : null}

        <div className={loadingGame ? "hidden" : "grid grid-cols-2 gap-3 pt-1"}>
          {(["normal", "max"] as GameVariant[]).map(game => {
            const href = gameLaunchUrl(game, navigator.userAgent, window.location.href);
            // A navegação acontece no próprio toque, sem timers ou await.
            return <a key={game} href={href ?? "#"} onClick={event => {
                setAttempted(true);
                if (!href) { event.preventDefault(); return; }
                event.preventDefault();
                setLoadingGame(game);
                setLoaded(false);
                window.setTimeout(() => {
                  setLoaded(true);
                  window.setTimeout(() => { window.location.href = href; }, 700);
                }, 1800);
              }} className="h-24 rounded-2xl glass flex flex-col items-center justify-center gap-2 font-bold text-sm hover:bg-white/10 active:scale-[0.98] transition-all">
              <Rocket className="w-5 h-5" />{game === "max" ? "Free Fire MAX" : "Free Fire"}
            </a>;
          })}
        </div>
        {attempted && <p role="status" className="text-sm text-muted-foreground">Se o jogo não abrir, abra-o pelo ícone no aparelho. Alguns navegadores ou versões do jogo não permitem abertura por link.</p>}
      </DialogContent>
    </Dialog>
  </>;
}
