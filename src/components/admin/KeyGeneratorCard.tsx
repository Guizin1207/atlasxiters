import { useState } from "react";
import { KeyRound, Loader2, Plus, ClipboardCopy, CalendarDays, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import type { KeyData } from "@/lib/key-context";
import { PLANS, getPlan, type PlanId } from "@/lib/atlas-config";
import { cn } from "@/lib/utils";

type KeyMode = "normal" | "daily" | "demo";

export function KeyGeneratorCard({ onCreated }: { onCreated?: () => void }) {
  const { password } = useAdmin();
  const [count, setCount] = useState(1);
  const [mode, setMode] = useState<KeyMode>("normal");
  const [plan, setPlan] = useState<PlanId>("basic");
  const [days, setDays] = useState(30);
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<KeyData[]>([]);

  const generate = async () => {
    if (!password) return;
    if (mode !== "demo" && !customerName.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }
    setBusy(true);
    const effectiveDays = mode === "normal" ? days : mode === "demo" ? 0 : 1;
    const effectivePlan: PlanId = mode === "demo" ? "demo" : plan;
    const effectiveNote = mode === "demo"
      ? ["DEMO", note.trim()].filter(Boolean).join(" — ")
      : note;
    const { data, error } = await supabase.rpc("admin_create_keys", {
      _count: count,
      _duration_days: effectiveDays,
      _note: effectiveNote,
      _password: password,
      _plan: effectivePlan,
      _customer_name: customerName.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error("Falha ao gerar", { description: error.message });
      return;
    }
    const arr = (data ?? []) as unknown as KeyData[];
    setGenerated(arr);
    toast.success(`${arr.length} chave(s) gerada(s)`);
    onCreated?.();
    // dispara evento global pra lista atualizar sem prop drilling
    window.dispatchEvent(new CustomEvent("atlas:keys-changed"));
  };

  const copyAll = async () => {
    if (!generated.length) return;
    const txt = generated.map((k) => k.key).join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Chaves copiadas");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <section className="glass-strong rounded-3xl p-6 space-y-5">
      <div>
        <p className="vip-eyebrow mb-1">Catálogo</p>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <KeyRound className="w-4 h-4" />
          Gerar chaves
        </h2>
      </div>

      <Field label="Nome do cliente">\n        <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ex: João Silva" className="rounded-xl bg-white/5 border-white/10 h-11" />\n        <p className="text-[11px] text-muted-foreground mt-2">A chave será criada automaticamente como NOME-PLANO-ATLS.</p>\n      </Field>\n\n      <Field label="Tipo de acesso">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ModeButton active={mode === "normal"} onClick={() => setMode("normal")} icon={<KeyRound className="w-3.5 h-3.5" />}>
            Normal
          </ModeButton>
          <ModeButton active={mode === "daily"} onClick={() => { setMode("daily"); setDays(1); }} icon={<CalendarDays className="w-3.5 h-3.5" />}>
            Diária
          </ModeButton>
          <ModeButton active={mode === "demo"} onClick={() => { setMode("demo"); setDays(1); }} icon={<FlaskConical className="w-3.5 h-3.5" />}>
            Demo
          </ModeButton>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {mode === "normal" ? "Duração personalizada." : mode === "daily" ? "Acesso de 1 dia após o primeiro uso." : "Acesso demo ilimitado e identificado como DEMO."}
        </p>
      </Field>

      {mode !== "demo" && (
        <Field label="Plano">
          <div className="grid grid-cols-3 gap-2">
            {PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPlan(p.id);
                  if (mode === "normal") setDays(p.days ?? 36500);
                }}
                className={cn(
                  "h-11 rounded-xl text-xs font-semibold uppercase tracking-[0.12em] border transition-colors",
                  plan === p.id
                    ? "bg-white text-black border-white"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {getPlan(plan).tagline}
          </p>
        </Field>
      )}
      {mode === "demo" && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Plano</p>
          <p className="mt-1 text-sm font-semibold">DEMO</p>
          <p className="text-[11px] text-muted-foreground">Sem Basic, Pro ou Master. Acesso demo ilimitado.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantidade">
          <Input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            className="rounded-xl bg-white/5 border-white/10 h-11"
          />
        </Field>
        <Field label="Duração (dias)">
          <Input
            type="number"
            min={1}
            value={days}
            disabled={mode !== "normal"}
            onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 30))}
            className="rounded-xl bg-white/5 border-white/10 h-11 disabled:opacity-60"
          />
        </Field>
      </div>

      <Field label="Nota (opcional)">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Ex: lote influencer abril"
          className="rounded-xl bg-white/5 border-white/10 resize-none"
        />
      </Field>

      <Button
        onClick={generate}
        disabled={busy}
        className="w-full h-12 rounded-2xl bg-white text-black hover:bg-white/90 font-bold uppercase tracking-[0.15em]"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Plus className="w-4 h-4 mr-2" />
        )}
        Gerar
      </Button>

      {generated.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="vip-eyebrow">Recém-criadas</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyAll}
              className="h-8 px-3 rounded-lg text-xs"
            >
              <ClipboardCopy className="w-3.5 h-3.5 mr-1.5" />
              Copiar todas
            </Button>
          </div>
          <div className="max-h-48 overflow-auto scrollbar-none space-y-1.5">
            {generated.map((k) => (
              <div
                key={k.id}
                className="font-mono text-xs px-3 py-2 bg-white/5 rounded-lg flex items-center justify-between"
              >
                <span className="truncate">{k.key}</span>
                <span className="text-[10px] text-muted-foreground ml-2">
                  {getPlan(k.plan).name} · {k.duration_days}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="vip-eyebrow block mb-2">{label}</span>
      {children}
    </label>
  );
}

function ModeButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn(
        "h-12 rounded-xl border text-[10px] font-semibold uppercase flex-col gap-1",
        active ? "bg-white text-black border-white hover:bg-white/90" : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {children}
    </Button>
  );
}
