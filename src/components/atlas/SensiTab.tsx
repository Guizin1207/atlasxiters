import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Cpu, Crosshair, Gauge, Smartphone, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message as AiMessage, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";
import type { SensiResult, SensiStyle } from "@/lib/atlas-sensi";
import atlasAiLogo from "@/assets/atlas-ai-logo.png";

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
    "resposta",
  ];
  return fields.slice(0, -1).every((field) => typeof result[field] === "number") &&
    typeof result.resposta === "string";
}

const SENSI_ITEMS = [
  ["Geral", "geral"],
  ["Red Dot", "pontoVermelho"],
  ["Mira 2x", "mira2x"],
  ["Mira 4x", "mira4x"],
  ["AWM", "miraAwm"],
  ["Olhar Livre", "olharLivre"],
] as const;

const QUICK_PROMPTS = ["Mais capa", "Mais controle", "Rush", "AWM"] as const;

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
      text: "Me diga seu aparelho + ajuste. Ex.: “iPhone 13, mais capa no rush”.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SensiResult | null>(null);
  const [copied, setCopied] = useState(false);
  const deviceLabel = useMemo(() => formatDevice(device), [device]);
  const isIOS = /iphone|ipad|ipod/i.test(device);
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
    document.getElementById("sensi-message")?.focus();
  }, [busy]);

  const send = async (text = input) => {
    const question = text.trim();
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
          screen: screenProfile,
          chat: next.slice(-8),
          question,
        },
      });

      if (error || !isSensiResult(data)) {
        const message = (data as { error?: string } | null)?.error || error?.message || "Resposta inválida da IA.";
        throw new Error(message);
      }

      setResult(data);

      setMessages((current) => [
        ...current,
        { role: "ai", text: `Pronto. ${formatDevice(inferredDevice)} • FF 2026\n${data.resposta}` },
      ]);
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

  const useQuickPrompt = (prompt: string) => {
    if (!device) {
      setInput(`${prompt}. Meu aparelho é `);
      requestAnimationFrame(() => document.getElementById("sensi-message")?.focus());
      return;
    }
    void send(prompt);
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
    <section aria-label="Chat de sensibilidade" className="space-y-3">
      <div className="glass-strong overflow-hidden rounded-2xl border border-border/10 shadow-2xl">
        <div className="border-b border-border/10 px-3.5 py-4 min-[390px]:px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/10 bg-secondary">
              <img src={atlasAiLogo} alt="Sensi AI" className="h-10 w-10 object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-black">Sensi AI</h2>
                <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-semibold uppercase text-status-active">
                  <span className="status-dot bg-status-active" /> online
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Calibração FF 2026 por aparelho e proporção de tela</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/10 bg-secondary" title="Motor de calibração FF 2026">
              <Crosshair className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-lg border border-border/10 bg-secondary/50 px-2.5 py-2">
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" />
                Aparelho
              </span>
              <span className="mt-1 block truncate text-xs font-semibold">{deviceLabel || "Informe no chat"}</span>
            </div>
            <div className="rounded-lg border border-border/10 bg-secondary/50 px-2.5 py-2">
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" /> Tela detectada
              </span>
              <span className="mt-1 block text-xs font-semibold">{screenProfile.width}×{screenProfile.height} • {screenProfile.ratio}:1</span>
            </div>
          </div>
        </div>

        <Conversation className="h-[clamp(230px,38vh,340px)]">
          <ConversationContent className="gap-4 p-3.5 min-[390px]:p-4">
            {messages.map((message, index) => (
              <AiMessage key={`${message.role}-${index}`} from={message.role === "ai" ? "assistant" : "user"}>
                <MessageContent className={message.role === "user" ? "bg-primary text-primary-foreground" : "px-0 py-0"}>
                  <MessageResponse className="whitespace-pre-line text-[13px] leading-5">{message.text}</MessageResponse>
                </MessageContent>
              </AiMessage>
            ))}
            {busy && (
              <AiMessage from="assistant">
                <MessageContent className="px-0 py-0">
                  <Shimmer className="text-xs">Analisando aparelho, tela e estilo…</Shimmer>
                </MessageContent>
              </AiMessage>
            )}
          </ConversationContent>
          <ConversationScrollButton className="bottom-2 h-8 w-8" />
        </Conversation>

        <div className="scrollbar-none flex gap-2 overflow-x-auto border-t border-border/10 px-3 py-2.5">
          {QUICK_PROMPTS.map((prompt) => (
            <Button key={prompt} type="button" variant="secondary" size="sm" disabled={busy} onClick={() => useQuickPrompt(prompt)} className="h-8 shrink-0 rounded-lg px-3 text-[11px]">
              {prompt}
            </Button>
          ))}
        </div>

        {result && (
          <div className="mx-3 mb-3 overflow-hidden rounded-xl border border-border/10 bg-secondary/20">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <p className="vip-eyebrow">CONFIGURAÇÃO CALIBRADA</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{deviceLabel || "Seu aparelho"} • FF 2026</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={copy}
                className="h-9 shrink-0 rounded-lg border border-border/10 bg-secondary px-3 text-xs"
              >
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
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
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
                <p className="text-[11px] leading-4 text-muted-foreground">
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


          </div>
        )}

        <div className="border-t border-border/10 p-3">
          <PromptInput onSubmit={({ text }) => void send(text)} className="rounded-xl border-border/10 bg-secondary/50">
            <PromptInputTextarea
              id="sensi-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={busy}
              placeholder="Modelo do aparelho e ajuste desejado…"
              className="min-h-14 px-3 pt-3 text-sm"
            />
            <PromptInputFooter className="justify-between px-2 pb-2">
              <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Cpu className="h-3 w-3" /> FF 2026
              </span>
              <PromptInputSubmit status={busy ? "submitted" : "ready"} disabled={busy || !input.trim()} className="h-9 w-9 rounded-lg" />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </section>
  );
}
