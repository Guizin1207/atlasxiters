import { useState } from "react";
import { KeyRound, Loader2, Plus, ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import type { KeyData } from "@/lib/key-context";

export function KeyGeneratorCard({ onCreated }: { onCreated?: () => void }) {
  const { password } = useAdmin();
  const [count, setCount] = useState(1);
  const [days, setDays] = useState(30);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<KeyData[]>([]);

  const generate = async () => {
    if (!password) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_create_keys", {
      _count: count,
      _duration_days: days,
      _note: note,
      _password: password,
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
            onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 30))}
            className="rounded-xl bg-white/5 border-white/10 h-11"
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
                  {k.duration_days}d
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
