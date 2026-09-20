import { useState } from "react";
import { Sparkles, Loader2, Copy, Check, Smartphone, Crosshair, Gauge, Zap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { SensiResult, SensiStyle } from "@/lib/atlas-sensi";

const STYLES: { id: SensiStyle; label: string }[] = [
  { id: "precisao", label: "Precisão" },
  { id: "equilibrado", label: "Equilíbrio" },
  { id: "agressivo", label: "Agressivo" },
];

function isSensiResult(value: unknown): value is SensiResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  const fields = [
    "geral",
    "pontoVermelho",
    "mira2x",
    "mira4x",
    "miraAwm",
    "olharLivre",
    "dpiRecomendado",
    "precisaoEstimada",
  ];
  return fields.every((field) => typeof result[field] === "number") &&
    Array.isArray(result.notas) &&
    result.notas.every((note) => typeof note === "string");
}

/**
 * Gerador de sensibilidade com IA — base Free Fire 2026.
 */
export function SensiTab() {
  const [device, setDevice] = useState("");
  const [dpi, setDpi] = useState(480);
  const [fingers, setFingers] = useState<2 | 3 | 4>(3);
  const [style, setStyle] = useState<SensiStyle>("equilibrado");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SensiResult | null>(null);
  const [aiMode, setAiMode] = useState<"analisando" | "pronto">("pronto");
  const [copied, setCopied] = useState(false);
  const isIOS = /iphone|ipad|ipod/i.test(device);

  const run = async () => {
    if (!device.trim()) {
      toast.error("Informe o modelo do aparelho");
      return;
    }

    setBusy(true);
    setAiMode("analisando");
    setResult(null);

    const generateLocal = async () => {
      const { generateSensi } = await import("@/lib/atlas-sensi");
      return generateSensi({ device, dpi, fingers, style });
    };

    try {
      const { data, error } = await supabase.functions.invoke("sensi-ai", {
        body: { device, dpi, fingers, style },
      });

      if (!error && isSensiResult(data)) {
        setResult(data);
        setAiMode("pronto");
        toast.success("Perfil IA analisado");
        return;
      }

      const fallback = await generateLocal();
      setResult(fallback);
      setAiMode("pronto");
      toast.success("Perfil inteligente gerado", {
        description: "Configuração gerada pelo motor inteligente do Atlas, ajustada ao seu aparelho e estilo.",
      });
    } catch (error) {
      console.error("sensi-ai", error);
      const fallback = await generateLocal();
      setResult(fallback);
      setAiMode("pronto");
      toast.success("Perfil inteligente gerado", {
        description: "Motor inteligente local ativado com ajuste por aparelho, DPI, dedos e estilo.",
      });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    const txt = [
      `Sensibilidade Atlas VIP — ${device} (FF 2026)`,
      `Geral: ${result.geral}`,
      `Ponto vermelho: ${result.pontoVermelho}`,
      `Mira 2x: ${result.mira2x}`,
      `Mira 4x: ${result.mira4x}`,
      `Mira AWM: ${result.miraAwm}`,
      `Olhar livre: ${result.olharLivre}`,
      ...(isIOS ? [] : [`DPI recomendado: ${result.dpiRecomendado}`]),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      toast.success("Sensibilidade copiada");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <section aria-label="Gerador de sensibilidade" className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-transparent p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-white text-black flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
          <div>
            <p className="vip-eyebrow mb-1">ATLAS AI • FREE FIRE 2026</p>
            <h2 className="text-xl font-bold">Análise profissional de sensibilidade</h2>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">A IA cruza aparelho, plataforma, DPI, dedos e estilo para montar um perfil completo de mira.</p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {[
            [Smartphone, "Aparelho"],
            [Crosshair, "Mira"],
            [Gauge, "Controle"],
            [Zap, "Resposta"],
          ].map(([Icon, label]) => <div key={label as string} className="rounded-xl bg-white/5 p-3 text-xs"><Icon className="w-4 h-4 mb-2" /><span>{label as string}</span></div>)}
        </div>
      </div>

      <div className="glass-strong rounded-2xl p-5 space-y-4">
        <label className="block">
          <span className="vip-eyebrow block mb-2">Aparelho</span>
          <Input
            value={device}
            onChange={(e) => setDevice(e.target.value)}
            placeholder="Ex: Redmi Note 12"
            className="rounded-xl bg-white/5 border-white/10 h-11"
          />
        </label>

        <div className={cn("grid gap-3", isIOS ? "grid-cols-1" : "grid-cols-2")}>
          <label className={cn("block", isIOS && "hidden")}>
            <span className="vip-eyebrow block mb-2">DPI do aparelho</span>
            <Input
              type="number"
              min={180}
              max={900}
              value={dpi}
              onChange={(e) =>
                setDpi(Math.max(180, Math.min(900, Number(e.target.value) || 480)))
              }
              className="rounded-xl bg-white/5 border-white/10 h-11"
            />
          </label>
          <div>
            <span className="vip-eyebrow block mb-2">Dedos</span>
            <div className="grid grid-cols-3 gap-1.5">
              {([2, 3, 4] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFingers(f)}
                  className={cn(
                    "h-11 rounded-xl text-xs font-bold border transition-colors",
                    fingers === f
                      ? "bg-white text-black border-white"
                      : "bg-white/5 border-white/10 text-muted-foreground"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className="vip-eyebrow block mb-2">Estilo de jogo</span>
          <div className="grid grid-cols-3 gap-2">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={cn(
                  "h-11 rounded-xl text-[11px] font-semibold uppercase tracking-[0.1em] border transition-colors",
                  style === s.id
                    ? "bg-white text-black border-white"
                    : "bg-white/5 border-white/10 text-muted-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={run}
          disabled={busy}
          className="w-full h-12 rounded-2xl bg-white text-black hover:bg-white/90 font-bold uppercase tracking-[0.15em]"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {busy ? "IA analisando aparelho…" : "Analisar com IA"}
        </Button>
      </div>

      {result && (
        <div className="glass-strong rounded-2xl p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="vip-eyebrow">Análise personalizada</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={copy}
              className="h-8 px-3 rounded-lg text-xs"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 mr-1.5 text-status-active" />
              ) : (
                <Copy className="w-3.5 h-3.5 mr-1.5" />
              )}
              Copiar
            </Button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3"><ShieldCheck className="w-4 h-4" /><span className="text-xs font-semibold">Perfil gerado para {device}</span></div>
            <div className="space-y-2.5">
            <Bar label="Geral" value={result.geral} />
            <Bar label="Ponto vermelho" value={result.pontoVermelho} />
            <Bar label="Mira 2x" value={result.mira2x} />
            <Bar label="Mira 4x" value={result.mira4x} />
            <Bar label="Mira AWM" value={result.miraAwm} />
            <Bar label="Olhar livre" value={result.olharLivre} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!isIOS && (
              <div className="rounded-xl bg-white/5 px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                  DPI recomendado
                </p>
                <p className="font-mono font-bold">{result.dpiRecomendado}</p>
              </div>
            )}
            <div className="rounded-xl bg-white/5 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                Ajuste estimado
              </p>
              <p className="font-mono font-bold text-status-active">
                {result.precisaoEstimada}%
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">compatibilidade estimada do perfil</p>
            </div>
          </div>

          <ul className="space-y-2">
            {result.notas.map((n, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-2">
                <span className="text-foreground">•</span>
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-bold tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-all"
          style={{ width: `${Math.min(100, (value / 200) * 100)}%` }}
        />
      </div>
    </div>
  );
}
