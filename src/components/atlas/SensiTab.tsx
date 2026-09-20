import { useState } from "react";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
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
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (!device.trim()) {
      toast.error("Informe o modelo do aparelho");
      return;
    }

    setBusy(true);
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
        toast.success("Sensi IA gerada para Free Fire 2026");
        return;
      }

      const fallback = await generateLocal();
      setResult(fallback);
      toast.success("Sensi gerada para Free Fire 2026", {
        description: "O servidor da IA não respondeu; use esta configuração e teste no treinamento.",
      });
    } catch (error) {
      console.error("sensi-ai", error);
      const fallback = await generateLocal();
      setResult(fallback);
      toast.success("Sensi gerada para Free Fire 2026", {
        description: "Modo local ativado para a sensi não ficar indisponível.",
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
      `DPI recomendado: ${result.dpiRecomendado}`,
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
      <div>
        <p className="vip-eyebrow mb-1">Free Fire 2026 • IA</p>
        <h2 className="text-xl font-bold">Gerador de sensi IA</h2>
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

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="vip-eyebrow block mb-2">DPI atual</span>
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
          {busy ? "IA analisando…" : "Gerar sensi IA"}
        </Button>
      </div>

      {result && (
        <div className="glass-strong rounded-2xl p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="vip-eyebrow">Resultado da IA</p>
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

          <div className="space-y-2.5">
            <Bar label="Geral" value={result.geral} />
            <Bar label="Ponto vermelho" value={result.pontoVermelho} />
            <Bar label="Mira 2x" value={result.mira2x} />
            <Bar label="Mira 4x" value={result.mira4x} />
            <Bar label="Mira AWM" value={result.miraAwm} />
            <Bar label="Olhar livre" value={result.olharLivre} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                DPI recomendado
              </p>
              <p className="font-mono font-bold">{result.dpiRecomendado}</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                Ajuste estimado
              </p>
              <p className="font-mono font-bold text-status-active">
                {result.precisaoEstimada}%
              </p>
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
