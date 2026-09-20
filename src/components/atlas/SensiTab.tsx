import { useMemo, useState } from "react";
import { Check, Copy, Cpu, Loader2, MessageCircle, Sparkles, Smartphone, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { SensiResult, SensiStyle } from "@/lib/atlas-sensi";

type Message = { role: "ai" | "user"; text: string };

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

const SENSI_ITEMS = [
  ["Geral", "geral"],
  ["Red Dot", "pontoVermelho"],
  ["Mira 2x", "mira2x"],
  ["Mira 4x", "mira4x"],
  ["AWM", "miraAwm"],
  ["Olhar Livre", "olharLivre"],
] as const;

function inferDevice(text: string) {
  return text.match(/(?:iphone|ipad|redmi|poco|samsung|galaxy|motorola|moto|realme|infinix|tecno|xiaomi|oppo|vivo|asus|rog|zenfone|honor|oneplus|nothing|google\s+pixel)[^,.!?]*/i)?.[0]?.trim() || "";
}

function formatDevice(device: string) {
  return device
    .replace(/\s+/g, " ")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

/**
 * Gerador de sensibilidade com IA — Free Fire 2026.
 * A configuração é calibrada pelo modelo do aparelho, tela/proporção,
 * fluidez, taxa de atualização, estilo e contexto da conversa.
 */
export function SensiTab() {
  const [device, setDevice] = useState("");
  const [dpi] = useState(480);
  const [fingers] = useState<2 | 3 | 4>(3);
  const [style] = useState<SensiStyle>("equilibrado");
  const [refreshRate] = useState<60 | 90 | 120>(90);
  const [ram] = useState<"3-4" | "6-8" | "12+">("6-8");
  const [deviceAge] = useState(1);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "Fala! Sou a Sensi AI do Atlas VIP. Me diga seu aparelho e o que você quer ajustar. Eu calibro a sensibilidade para o seu dispositivo e para o seu estilo no Free Fire 2026.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SensiResult | null>(null);
  const [copied, setCopied] = useState(false);

  const deviceLabel = useMemo(() => formatDevice(device), [device]);
  const isIOS = /iphone|ipad|ipod/i.test(device);

  const send = async () => {
    const question = input.trim();
    if (!question || busy) return;

    const inferredDevice = device || inferDevice(question);
    const next = [...messages, { role: "user" as const, text: question }];
    setMessages(next);
    setInput("");

    if (!inferredDevice) {
      setMessages((current) => [
        ...current,
        {
          role: "ai",
          text: "Antes de calibrar, me diga o modelo do aparelho. Ex.: iPhone 13, Galaxy A55, Redmi Note 13 ou Moto G84.",
        },
      ]);
      return;
    }

    if (!device) setDevice(inferredDevice);
    setBusy(true);

    try {
      const { data, error } = await supabase.functions.invoke("sensi-ai", {
        body: {
          device: inferredDevice,
          dpi,
          fingers,
          style,
          refreshRate,
          ram,
          deviceAge,
          chat: next.slice(-8),
          question,
        },
      });

      if (error || !isSensiResult(data)) {
        const message = (data as { error?: string } | null)?.error || error?.message || "Resposta inválida da IA.";
        throw new Error(message);
      }

      setResult(data);

      const summary = [
        `Pronto. Calibrei a sensi para ${formatDevice(inferredDevice)}.`,
        `Geral ${data.geral} • Red Dot ${data.pontoVermelho} • 2x ${data.mira2x} • 4x ${data.mira4x}`,
        `AWM ${data.miraAwm} • Olhar Livre ${data.olharLivre}`,
        data.notas?.[0] ? data.notas[0] : "O perfil foi ajustado para equilibrar arrasto, controle e troca de alvo.",
      ].join("\n");

      setMessages((current) => [...current, { role: "ai", text: summary }]);
    } catch (error) {
      console.error("sensi-ai", error);
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      setMessages((current) => [
        ...current,
        { role: "ai", text: `Não consegui gerar agora. ${message}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    const txt = [
      `Sensibilidade Atlas VIP — ${deviceLabel || "Free Fire"} (FF 2026)`,
      `Geral: ${result.geral}`,
      `Ponto vermelho: ${result.pontoVermelho}`,
      `Mira 2x: ${result.mira2x}`,
      `Mira 4x: ${result.mira4x}`,
      `Mira AWM: ${result.miraAwm}`,
      `Olhar livre: ${result.olharLivre}`,
      ...(!isIOS && result.dpiRecomendado ? [`DPI recomendado: ${result.dpiRecomendado}`] : []),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      toast.success("Sensi copiada");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <section aria-label="Chat de sensibilidade" className="space-y-4">
      <div className="glass-strong rounded-[28px] overflow-hidden border border-white/10 shadow-2xl">
        <div className="relative overflow-hidden border-b border-white/10 px-4 py-5 sm:px-5">
          <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/[0.06] blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-black shadow-lg">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="vip-eyebrow">ATLAS VIP • SENSI AI</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> online
                </span>
              </div>
              <h2 className="mt-0.5 text-xl font-black tracking-tight">Sensi sob medida para seu aparelho</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Free Fire 2026 • tela, proporção, fluidez e estilo entram na calibração
              </p>
            </div>
          </div>

          {deviceLabel && (
            <div className="relative mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold">
                <Smartphone className="h-3.5 w-3.5" />
                {deviceLabel}
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-muted-foreground">
                <Cpu className="h-3.5 w-3.5" />
                Perfil proporcional
              </span>
              {isIOS && (
                <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-muted-foreground">
                  DPI não usado no iOS
                </span>
              )}
            </div>
          )}
        </div>

        <div className="max-h-[380px] space-y-3 overflow-y-auto p-4 sm:p-5">
          {messages.map((message, index) => (
            <div key={index} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[92%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[84%]",
                  message.role === "user"
                    ? "rounded-br-md bg-white text-black"
                    : "rounded-bl-md border border-white/10 bg-white/[0.045] text-foreground",
                )}
              >
                {message.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.045] px-4 py-3 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Calibrando pelo seu aparelho…</span>
              </div>
            </div>
          )}
        </div>

        {result && (
          <div className="mx-3 mb-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] sm:mx-4 sm:mb-4">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <p className="vip-eyebrow">CONFIGURAÇÃO CALIBRADA</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{deviceLabel || "Seu aparelho"} • FF 2026</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={copy}
                className="h-9 shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs"
              >
                {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-3">
              {SENSI_ITEMS.map(([label, key]) => {
                const value = result[key];
                return (
                  <div key={label} className="bg-[#111] p-3.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                      <span className="font-mono text-lg font-black tabular-nums">{value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-700"
                        style={{ width: `${Math.min(100, Math.max(8, (value / 200) * 100))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-2 border-t border-white/10 p-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold">
                  <Zap className="h-3.5 w-3.5" />
                  Perfil da calibração
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Ajuste pensado para o comportamento do dispositivo e para o pedido mais recente, mantendo controle de arrasto e estabilidade.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <div className="mb-1 text-xs font-semibold">
                  {isIOS ? "iPhone / iPad" : "Android"}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {isIOS
                    ? "A calibração não usa DPI. O foco fica no modelo, tela, fluidez, toque e estilo."
                    : `DPI entra como fator secundário. Recomendação: ${result.dpiRecomendado} DPI.`}
                </p>
              </div>
            </div>

            {result.notas?.length > 0 && (
              <div className="border-t border-white/10 px-4 py-3">
                <p className="vip-eyebrow mb-2">RESPOSTA DA IA</p>
                <div className="space-y-1.5">
                  {result.notas.slice(0, 4).map((note, index) => (
                    <p key={index} className="text-xs leading-5 text-muted-foreground">
                      • {note}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-white/10 bg-black/10 p-3 sm:p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              placeholder="Ex.: iPhone 13, quero mais capa no rush"
              className="h-12 rounded-2xl border-white/10 bg-white/[0.045] px-4"
            />
            <Button
              onClick={() => void send()}
              disabled={busy || !input.trim()}
              className="h-12 w-12 shrink-0 rounded-2xl bg-white p-0 text-black shadow-lg"
              aria-label="Enviar"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
            <MessageCircle className="h-3 w-3" />
            <span>Peça “mais capa”, “mais controle”, “rush”, “AWM” ou mande um novo ajuste.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
