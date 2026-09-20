/**
 * Card /admin — pedidos de upgrade de plano feitos pelos usuários.
 */
import { useCallback, useEffect, useState } from "react";
import { ArrowUpCircle, Check, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import { getPlan } from "@/lib/atlas-config";
import { cn } from "@/lib/utils";

type Req = {
  id: string;
  key: string;
  key_id: string;
  requested_plan: string;
  current_plan: string | null;
  message: string | null;
  status: string;
  created_at: string;
  device: string | null;
};

export function UpgradeRequestsCard() {
  const { password } = useAdmin();
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!password) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_upgrade_requests", {
      _password: password,
    });
    setLoading(false);
    if (error) {
      toast.error("Falha ao carregar pedidos", { description: error.message });
      return;
    }
    setItems((data ?? []) as unknown as Req[]);
  }, [password]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (id: string, approve: boolean) => {
    if (!password) return;
    setBusy(id);
    const { error } = await supabase.rpc("admin_resolve_upgrade_request", {
      _password: password,
      _id: id,
      _approve: approve,
    });
    setBusy(null);
    if (error) {
      toast.error("Falha na ação", { description: error.message });
      return;
    }
    toast.success(approve ? "Upgrade aplicado" : "Pedido recusado");
    await load();
    window.dispatchEvent(new CustomEvent("atlas:keys-changed"));
  };

  const pending = items.filter((i) => i.status === "pending");
  const done = items.filter((i) => i.status !== "pending").slice(0, 10);

  const clearHistory = () => {
    setItems((current) => current.filter((item) => item.status === "pending"));
    toast.success("Histórico limpo da tela");
  };

  return (
    <section className="glass-strong rounded-3xl p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="vip-eyebrow mb-1">Assinaturas</p>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4" />
            Pedidos de upgrade
            {pending.length > 0 && (
              <span className="text-[10px] bg-white text-black rounded-full px-2 py-0.5 font-bold">
                {pending.length}
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {done.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearHistory} className="rounded-xl">
              <Trash2 className="w-4 h-4 mr-1.5" />
              Limpar histórico
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={load} className="rounded-xl">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nenhum pedido até agora.
        </p>
      ) : (
        <div className="space-y-2">
          {pending.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs truncate">{r.key}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {getPlan(r.current_plan).name} → {getPlan(r.requested_plan).name}
                    {r.device ? ` · ${r.device}` : ""}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    disabled={busy === r.id}
                    onClick={() => resolve(r.id, true)}
                    className="h-9 rounded-xl bg-white text-black hover:bg-white/90"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === r.id}
                    onClick={() => resolve(r.id, false)}
                    className="h-9 rounded-xl bg-white/5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {r.message && (
                <p className="text-xs text-muted-foreground">{r.message}</p>
              )}
            </div>
          ))}

          {done.map((r) => (
            <div
              key={r.id}
              className="rounded-xl px-4 py-2.5 bg-white/[0.02] flex items-center justify-between text-xs"
            >
              <span className="font-mono truncate">{r.key}</span>
              <span
                className={cn(
                  "ml-3 shrink-0 uppercase tracking-[0.15em] text-[10px]",
                  r.status === "approved" ? "text-status-active" : "text-status-danger"
                )}
              >
                {r.status === "approved" ? "Aprovado" : "Recusado"} ·{" "}
                {getPlan(r.requested_plan).name}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
