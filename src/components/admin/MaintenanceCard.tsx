import { useEffect, useState } from "react";
import { Wrench, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";

export function MaintenanceCard() {
  const { password } = useAdmin();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.rpc("get_maintenance");
      if (!mounted) return;
      const obj = (data ?? {}) as { enabled?: boolean; message?: string };
      setEnabled(!!obj.enabled);
      setMessage(obj.message ?? "");
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    if (!password) return;
    setSaving(true);
    const { error } = await supabase.rpc("admin_set_maintenance", {
      _enabled: enabled,
      _message: message,
      _password: password,
    });
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar", { description: error.message });
    } else {
      toast.success(enabled ? "Manutenção ATIVADA" : "Manutenção desativada");
    }
  };

  return (
    <section className="glass-strong rounded-3xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="vip-eyebrow mb-1">Sistema</p>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Manutenção
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-[10px] uppercase tracking-[0.2em] font-bold ${
              enabled ? "text-status-warning" : "text-muted-foreground"
            }`}
          >
            {enabled ? "ON" : "OFF"}
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={loading}
          />
        </div>
      </div>

      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={loading}
        rows={4}
        placeholder="Mensagem exibida durante a manutenção…"
        className="rounded-2xl bg-white/5 border-white/10 resize-none focus-visible:ring-white/30"
      />

      <Button
        onClick={save}
        disabled={loading || saving}
        className="w-full h-12 rounded-2xl bg-white text-black hover:bg-white/90 font-bold uppercase tracking-[0.15em]"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Salvar
      </Button>

      <p className="text-[11px] text-muted-foreground">
        Quando ON, todos os usuários (exceto chave master) veem o modal de
        manutenção e ficam bloqueados.
      </p>
    </section>
  );
}
