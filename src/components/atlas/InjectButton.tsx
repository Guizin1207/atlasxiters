import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Variant = "normal" | "max";

const ANDROID_PACKAGE: Record<Variant, string> = {
  normal: "com.dts.freefireth",
  max: "com.dts.freefiremax",
};

const IOS_SCHEME: Record<Variant, string> = {
  normal: "freefire://",
  max: "freefiremax://",
};

function platform(): "android" | "ios" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "other";
}

function openGame(v: Variant) {
  const os = platform();
  if (os === "android") {
    window.location.href = `intent://#Intent;package=${ANDROID_PACKAGE[v]};scheme=android-app;launchFlags=0x10000000;end`;
    return;
  }
  if (os === "ios") window.location.href = IOS_SCHEME[v];
}

/**
 * CTA visual do Atlas: escolhe a versão, exibe o carregamento e abre o jogo.
 * Não executa injeção de DLL, manipulação de memória ou bypass de anti-cheat.
 */
export function InjectButton() {
  const [open, setOpen] = useState(false);
  const [loadingGame, setLoadingGame] = useState<Variant | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!loadingGame) return;

    setProgress(0);
    const startedAt = Date.now();
    const duration = 4200;

    const timer = window.setInterval(() => {
      const next = Math.min(100, Math.round(((Date.now() - startedAt) / duration) * 100));
      setProgress(next);

      if (next >= 100) {
        window.clearInterval(timer);
        window.setTimeout(() => {
          const selected = loadingGame;
          setLoadingGame(null);
          setOpen(false);
          openGame(selected);
        }, 350);
      }
    }, 80);

    return () => window.clearInterval(timer);
  }, [loadingGame]);

  const start = (v: Variant) => {
    setOpen(false);
    setLoadingGame(v);
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 px-5 w-full max-w-md">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full h-16 rounded-2xl bg-white text-black font-bold uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 shadow-elevated active:scale-[0.98] transition-transform"
        >
          <Rocket className="w-4 h-4" />
          Injetar
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Escolha o jogo</DialogTitle>
            <DialogDescription>
              Selecione qual versão do Free Fire deseja iniciar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {(["normal", "max"] as Variant[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => start(v)}
                className={cn(
                  "h-24 rounded-2xl glass flex flex-col items-center justify-center gap-2 font-bold text-sm hover:bg-white/10 active:scale-[0.98] transition-all"
                )}
              >
                <Rocket className="w-5 h-5" />
                {v === "max" ? "Free Fire MAX" : "Free Fire"}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {loadingGame && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-5 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-[#080808] p-6 shadow-2xl">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04]">
              <Rocket className="h-9 w-9 text-white" />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 font-mono text-[12px] leading-7 text-white/70">
              <p>&gt; Preparando módulos...</p>
              <p className={progress >= 32 ? "text-white/70" : "text-white/25"}>
                &gt; Aplicando configurações...
              </p>
              <p className={progress >= 68 ? "text-white/70" : "text-white/25"}>
                &gt; Iniciando {loadingGame === "max" ? "Free Fire MAX" : "Free Fire"}...
              </p>
            </div>

            <div className="mt-6 flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-white/35">Atlas</p>
                <p className="mt-1 text-sm font-semibold text-white">Carregando</p>
              </div>
              <span className="font-mono text-2xl font-bold text-white">{progress}%</span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
