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
  const [refreshRate, setRefreshRate] = useState<60 | 90 | 120>(90);
  const [ram, setRam] = useState<"3-4" | "6-8" | "12+">("6-8");
  const [deviceAge, setDeviceAge] = useState(1);
  const [messages, setMessages] = useState<Array<{ role: "ai" | "user"; text: string }>>([
    { role: "ai", text: "Fala! Sou a Sensi AI do Atlas VIP. Me diga seu aparelho e o que você quer ajustar que eu monto e ajusto sua sensibilidade para Free Fire 2026." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SensiResult | null>(null);
  const [copied, setCopied] = useState(false);

  const send = async () => {
    const question = input.trim();
    if (!question || busy) return;
    const next = [...messages, { role: "user" as const, text: question }];
    setMessages(next);
    setInput("");
    setBusy(true);
    const inferredDevice = device || question.match(/(?:iphone|ipad|redmi|poco|samsung|galaxy|motorola|moto|realme|infinix|tecno|xiaomi|oppo|vivo)[^,.!?]*/i)?.[0] || "";
    if (inferredDevice && !device) setDevice(inferredDevice);
    try {
      const { data, error } = await supabase.functions.invoke("sensi-ai", {
        body: { device: inferredDevice || device || "aparelho não informado", dpi, fingers, style, refreshRate, ram, deviceAge, chat: next.slice(-8), question },
      });
      if (error || !isSensiResult(data)) {\n        const message = (data as { error?: string } | null)?.error || error?.message || "Resposta inválida da IA.";\n        throw new Error(message);\n      }
      setResult(data);
      setMessages((current) => [...current, { role: "ai", text: "Ajustei sua sensi para " + (inferredDevice || device || "seu aparelho") + ".\n\nGeral " + data.geral + " • Red Dot " + data.pontoVermelho + " • 2x " + data.mira2x + " • 4x " + data.mira4x + " • AWM " + data.miraAwm + " • Olhar Livre " + data.olharLivre + (data.notas?.length ? "\n\n" + data.notas.slice(0, 3).join("\n") : "") }]);
    } catch (error) {
      console.error("sensi-ai", error);
      const message = error instanceof Error ? error.message : "Erro desconhecido.";\n      setMessages((current) => [...current, { role: "ai", text: `Não consegui gerar agora. ${message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    const txt = ["Sensibilidade Atlas VIP — " + (device || "Free Fire") + " (FF 2026)", "Geral: " + result.geral, "Ponto vermelho: " + result.pontoVermelho, "Mira 2x: " + result.mira2x, "Mira 4x: " + result.mira4x, "Mira AWM: " + result.miraAwm, "Olhar livre: " + result.olharLivre].join("\n");
    try { await navigator.clipboard.writeText(txt); setCopied(true); toast.success("Sensi copiada"); setTimeout(() => setCopied(false), 1500); } catch { toast.error("Não foi possível copiar"); }
  };

  return (
    <section aria-label="Chat de sensibilidade" className="space-y-4">
      <div className="glass-strong rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white text-black flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
          <div><p className="vip-eyebrow">ATLAS VIP • SENSI AI</p><h2 className="text-lg font-bold">Especialista em Sensi FF 2026</h2></div>
        </div>
        <div className="p-4 space-y-3 max-h-[460px] overflow-y-auto">
          {messages.map((message, index) => <div key={index} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}><div className={cn("max-w-[88%] rounded-2xl px-4 py-3 text-sm whitespace-pre-line", message.role === "user" ? "bg-white text-black rounded-br-md" : "bg-white/5 border border-white/10 rounded-bl-md")}>{message.text}</div></div>)}
          {busy && <div className="flex justify-start"><div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Analisando sua sensi…</div></div>}
        </div>
        {result && <div className="mx-4 mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center justify-between mb-3"><span className="vip-eyebrow">CONFIGURAÇÃO ATUAL</span><Button variant="ghost" size="sm" onClick={copy} className="h-8 px-3 rounded-lg text-xs">{copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />} Copiar</Button></div><div className="grid grid-cols-2 gap-x-4 gap-y-2">{[["Geral", result.geral], ["Red Dot", result.pontoVermelho], ["2x", result.mira2x], ["4x", result.mira4x], ["AWM", result.miraAwm], ["Olhar Livre", result.olharLivre]].map(([label, value]) => <div key={label as string} className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><b className="font-mono">{value as number}</b></div>)}</div></div>}
        <div className="p-3 border-t border-white/10"><div className="flex gap-2"><Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} placeholder="Ex: meu iPhone 13 está puxando muito..." className="rounded-xl bg-white/5 border-white/10 h-11" /><Button onClick={() => void send()} disabled={busy || !input.trim()} className="h-11 w-11 p-0 rounded-xl bg-white text-black"><Sparkles className="w-4 h-4" /></Button></div><p className="text-[10px] text-muted-foreground mt-2 px-1">Peça “mais capa”, “mais controle”, “rush”, “AWM” ou informe seu aparelho.</p></div>
      </div>
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
