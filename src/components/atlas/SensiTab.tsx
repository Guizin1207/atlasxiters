import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Gauge, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { SensiResult } from "@/lib/atlas-sensi";

const SENSI_ITEMS = [
  ["Geral", "geral"],
  ["Red Dot", "pontoVermelho"],
  ["Mira 2x", "mira2x"],
  ["Mira 4x", "mira4x"],
  ["AWM", "miraAwm"],
  ["Olhar Livre", "olharLivre"],
] as const;

function detectDeviceFromBrowser() {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent || "";
  if (/iPad/i.test(ua)) return "iPad";
  if (/iPod/i.test(ua)) return "iPod";
  if (/iPhone/i.test(ua)) return "iPhone";
  const android = ua.match(/Android[^;)]*;\s*(?:[a-z]{2}-[A-Z]{2};\s*)?([^;)]+?)(?:\s+Build\/[^;)]+)?[;)]/i);
  return android?.[1]?.trim() || "";
}

function normalizeResult(value: unknown): SensiResult | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const number = (key: string) => {
    const n = Number(raw[key]);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const response = typeof raw.resposta === "string" ? raw.resposta.trim() : "";
  const keys = ["geral", "pontoVermelho", "mira2x", "mira4x", "miraAwm", "olharLivre", "dpiRecomendado", "precisaoEstimada"];
  if (keys.some((key) => number(key) === null) || !response) return null;
  return {
    geral: number("geral")!,
    pontoVermelho: number("pontoVermelho")!,
    mira2x: number("mira2x")!,
    mira4x: number("mira4x")!,
    miraAwm: number("miraAwm")!,
    olharLivre: number("olharLivre")!,
    dpiRecomendado: number("dpiRecomendado")!,
    precisaoEstimada: number("precisaoEstimada")!,
    resposta: response.slice(0, 140),
  };
}

export function SensiTab() {
  const [device, setDevice] = useState("");
  const [result, setResult] = useState<SensiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const screenProfile = useMemo(() => {
    if (typeof window === "undefined") return { width: 0, height: 0, ratio: "desconhecida", pixelRatio: 1 };
    const width = Math.round(window.screen.width);
    const height = Math.round(window.screen.height);
    const long = Math.max(width, height);
    const short = Math.min(width, height);
    return {
      width,
      height,
      ratio: short > 0 ? (long / short).toFixed(2) : "desconhecida",
      pixelRatio: Number(window.devicePixelRatio.toFixed(2)),
    };
  }, []);

  useEffect(() => {
    const detected = detectDeviceFromBrowser();
    if (detected) setDevice(detected);
  }, []);

  const isIOS = /iphone|ipad|ipod/i.test(device);
  const deviceLabel = device.trim() || "Seu aparelho";

  const generate = async () => {
    if (!device.trim() || busy) {
      toast.error("Não foi possível identificar o aparelho.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("sensi-ai", {
        body: {
          device: device.trim(),
          screen: screenProfile,
        },
      });

      const normalized = normalizeResult(data);
      if (error || !normalized) {
        throw new Error((data as { error?: string } | null)?.error || error?.message || "Resposta inválida.");
      }

      setResult(normalized);
      toast.success("Sensibilidade gerada");
    } catch (error) {
      console.error("sensi-ai", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar agora.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    const text = [
      `Sensibilidade Atlas VIP — ${deviceLabel} (FF 2026)`,
      `Geral: ${result.geral}`,
      `Ponto vermelho: ${result.pontoVermelho}`,
      `Mira 2x: ${result.mira2x}`,
      `Mira 4x: ${result.mira4x}`,
      `Mira AWM: ${result.miraAwm}`,
      `Olhar livre: ${result.olharLivre}`,
      ...(!isIOS && result.dpiRecomendado ? [`DPI recomendado: ${result.dpiRecomendado}`] : []),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Sensi copiada");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <section aria-label="Configuração de sensibilidade" className="space-y-3">
      <div className="glass-strong overflow-hidden rounded-2xl border border-border/10 shadow-2xl">
        <div className="border-b border-border/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/10 bg-secondary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black">Sensi</h2>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Configuração FF 2026 por aparelho e tela</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-lg border border-border/10 bg-secondary/50 px-2.5 py-2">
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Smartphone className="h-3.5 w-3.5" /> Aparelho</span>
              <span className="mt-1 block truncate text-xs font-semibold">{deviceLabel}</span>
            </div>
            <div className="rounded-lg border border-border/10 bg-secondary/50 px-2.5 py-2">
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Gauge className="h-3.5 w-3.5" /> Tela detectada</span>
              <span className="mt-1 block text-xs font-semibold">{screenProfile.width}×{screenProfile.height} • {screenProfile.ratio}:1</span>
            </div>
          </div>
        </div>

        <div className="p-4">
          <Button type="button" onClick={() => void generate()} disabled={busy || !device.trim()} className="h-11 w-full rounded-xl font-bold">
            {busy ? "Gerando..." : "Gerar sensibilidade"}
          </Button>
        </div>

        {result && (
          <div className="mx-3 mb-3 overflow-hidden rounded-xl border border-border/10 bg-secondary/20">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <p className="vip-eyebrow">CONFIGURAÇÃO</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{deviceLabel} • FF 2026</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void copy()} className="h-9 shrink-0 rounded-lg border border-border/10 bg-secondary px-3 text-xs">
                {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-px bg-border/10 min-[390px]:grid-cols-3">
              {SENSI_ITEMS.map(([label, key]) => {
                const value = result[key];
                return (
                  <div key={label} className="bg-card p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                      <span className="font-mono text-lg font-black tabular-nums">{value}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(8, (value / 200) * 100))}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/10 p-3">
              <p className="text-xs leading-5 text-muted-foreground">
                {isIOS
                  ? "Calibração sem DPI, usando aparelho, tela, toque e fluidez."
                  : `DPI secundário. Recomendado: ${result.dpiRecomendado} DPI.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
