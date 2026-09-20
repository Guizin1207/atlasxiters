import { useState } from "react";
import { Rocket, Loader2 } from "lucide-react";
import { toast } from "sonner";
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

const STORE: Record<Variant, string> = {
  normal: "https://play.google.com/store/apps/details?id=com.dts.freefireth",
  max: "https://play.google.com/store/apps/details?id=com.dts.freefiremax",
};

function platform(): "android" | "ios" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "other";
}

/**
 * CTA de injeção: abre o Free Fire (normal ou MAX) no Android/iOS.
 */
export function InjectButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Variant | null>(null);

  const launch = async (v: Variant) => {
    const os = platform();
    if (os === "other") {
      toast.error("Disponível só no celular", {
        description: "Abra o Atlas VIP no Android ou iOS para injetar no jogo.",
      });
      return;
    }
    setBusy(v);
    toast.success("Injeção aplicada", {
      description: `Abrindo Free Fire ${v === "max" ? "MAX" : "normal"}…`,
    });

    const url =
      os === "android"
        ? `intent://#Intent;package=${ANDROID_PACKAGE[v]};end`
        : IOS_SCHEME[v];

    const started = Date.now();
    window.location.assign(url);

    // Se o app não abrir em ~2.5s, oferece a loja.
    setTimeout(() => {
      setBusy(null);
      setOpen(false);
      if (Date.now() - started < 4000 && !document.hidden && os === "android") {
        toast.error("Jogo não encontrado", {
          description: "Instale ou atualize o Free Fire para continuar.",
          action: {
            label: "Abrir loja",
            onClick: () => window.open(STORE[v], "_blank"),
          },
        });
      }
    }, 2500);
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
              As funções ativas serão aplicadas ao abrir o Free Fire.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {(["normal", "max"] as Variant[]).map((v) => (
              <button
                key={v}
                type="button"
                disabled={busy !== null}
                onClick={() => launch(v)}
                className={cn(
                  "h-24 rounded-2xl glass flex flex-col items-center justify-center gap-2 font-bold text-sm hover:bg-white/10 active:scale-[0.98] transition-all",
                  busy === v && "bg-white text-black"
                )}
              >
                {busy === v ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Rocket className="w-5 h-5" />
                )}
                {v === "max" ? "Free Fire MAX" : "Free Fire"}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Abertura direta do jogo funciona apenas no Android e iOS.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
