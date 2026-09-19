/**
 * Aba "Planos" — mostra o plano atual e permite pedir upgrade.
 * O pedido fica registrado para o admin e abre o WhatsApp com a mensagem pronta.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Crown, Loader2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useKey } from "@/lib/key-context";
import {
  PLANS,
  PLAN_ORDER,
  getPlan,
  upgradeWhatsAppUrl,
  type PlanId,
} from "@/lib/atlas-config";
import { cn } from "@/lib/utils";

type Request = {
  id: string;
  requested_plan: string;
  status: string;
  created_at: string;
};

const ICONS: Record<PlanId, typeof Zap> = {
  basic: Zap,
  pro: Sparkles,
  master: Crown,
};

export function PlanosTab() {
  const { keyData } = useKey();
  const [requests, setRequests] = useState<Request[]>([]);
  const [busy, setBusy] = useState<PlanId | null>(null);

  const currentPlan = keyData?.is_master ? "master" : ((keyData?.plan as PlanId) ?? "basic");
  const currentIdx = PLAN_ORDER.indexOf(currentPlan);

  const load = useCallback(async () => {
    if (!keyData) return;
    const { data } = await supabase.rpc("list_my_upgrade_requests", { _key: keyData.key });
    setRequests((data ?? []) as unknown as Request[]);
  }, [keyData]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = (plan: PlanId) =>
    requests.some((r) => r.requested_plan === plan && r.status === "pending");

  const request = async (plan: PlanId) => {
    if (!keyData) return;
    setBusy(plan);
    const { error } = await supabase.rpc("request_upgrade", {
      _key: keyData.key,
      _plan: plan,
      _message: null,
    });
    setBusy(null);

    if (error && !error.message.includes("already_pending")) {
      toast.error("Não foi possível enviar o pedido", { description: error.message });
      return;
    }
    await load();
    toast.success("Pedido enviado", {
      description: "Estamos te levando ao WhatsApp para finalizar.",
    });
    window.open(upgradeWhatsAppUrl(keyData.key, plan), "_blank", "noreferrer");
  };

  if (!keyData) return null;

  return (
    <section aria-label="Planos" className="space-y-5">
      <div>
        <p className="vip-eyebrow mb-1">Assinatura</p>
        <h2 className="text-xl font-bold">Planos</h2>
      </div>

      <div className="glass-strong rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="vip-eyebrow mb-1">Plano atual</p>
          <p className="text-lg font-bold">{getPlan(currentPlan).name}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {getPlan(currentPlan).tagline}
        </span>
      </div>

      <div className="space-y-3">
        {PLANS.map((p, idx) => {
          const Icon = ICONS[p.id];
          const isCurrent = p.id === currentPlan;
          const isUpgrade = idx > currentIdx;
          const isPending = pending(p.id);

          return (
            <div
              key={p.id}
              className={cn(
                "rounded-2xl p-5 space-y-4 border transition-colors",
                isCurrent
                  ? "glass-strong border-white/25"
                  : "glass border-white/10"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold leading-tight">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.tagline}</p>
                  </div>
                </div>
                {isCurrent && (
                  <span className="text-[10px] uppercase tracking-[0.2em] bg-white text-black rounded-full px-2 py-1 font-bold">
                    Atual
                  </span>
                )}
              </div>

              <ul className="space-y-1.5">
                {p.perks.map((perk) => (
                  <li
                    key={perk}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Check className="w-3.5 h-3.5 text-status-active shrink-0" />
                    {perk}
                  </li>
                ))}
              </ul>

              {isUpgrade && (
                <Button
                  onClick={() => request(p.id)}
                  disabled={busy === p.id}
                  className="w-full h-11 rounded-xl bg-white text-black hover:bg-white/90 font-bold uppercase tracking-[0.15em] text-xs"
                >
                  {busy === p.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isPending ? "Pedido enviado — falar de novo" : `Fazer upgrade`}
                </Button>
              )}

              {isPending && (
                <p className="text-[11px] text-status-warning">
                  Pedido em análise pelo administrador.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
