/**
 * Aba "Planos" — mostra o plano atual e permite adquirir um plano pago.
 * O pedido fica registrado para o admin e abre o WhatsApp com a mensagem pronta.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Crown, FlaskConical, Loader2, Sparkles, Zap } from "lucide-react";
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
  demo: FlaskConical,
  basic: Zap,
  pro: Sparkles,
  master: Crown,
};

export function PlanosTab({ embedded = false }: { embedded?: boolean } = {}) {
  const { keyData } = useKey();
  const [requests, setRequests] = useState<Request[]>([]);
  const [busy, setBusy] = useState<PlanId | null>(null);

  const currentPlan = keyData?.is_master ? "master" : ((keyData?.plan as PlanId) ?? "basic");
  const currentIdx = PLAN_ORDER.indexOf(currentPlan);
  const isDemo = currentPlan === "demo";
  const demoHasExpiry = Boolean(keyData?.expires_at);
  const demoTagline = demoHasExpiry ? "Acesso demo com prazo" : "Acesso demo ilimitado";

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
      toast.error("Não foi possível registrar o pedido", {
        description: error.message,
      });
      return;
    }

    await load();

    const whatsappUrl = upgradeWhatsAppUrl(keyData.key, plan, currentPlan);
    const whatsappWindow = window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    if (!whatsappWindow) {
      window.location.href = whatsappUrl;
      return;
    }

    toast.success("Solicitação enviada", {
      description: "O pedido foi registrado no administrador e o WhatsApp foi aberto.",
    });
  };

  if (!keyData) return null;

  return (
    <section aria-label="Planos" className="space-y-5">
      {!embedded && (
        <div>
          <p className="vip-eyebrow mb-1">Assinatura</p>
          <h2 className="text-xl font-bold">Planos</h2>
        </div>
      )}

      <div className="glass-strong rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="vip-eyebrow mb-1">Plano atual</p>
          <p className="text-lg font-bold">{getPlan(currentPlan).name}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {isDemo ? demoTagline : getPlan(currentPlan).tagline}
        </span>
      </div>

      <div className="space-y-3">
        {(() => {
          const nextPlan = isDemo
            ? PLANS[0]
            : currentPlan === "basic"
              ? PLANS[1]
              : currentPlan === "pro"
                ? PLANS[2]
                : null;
          const isPending = nextPlan ? pending(nextPlan.id) : false;

          if (!nextPlan) return null;

          return (
            <div className="space-y-2">
              <Button
                onClick={() => request(nextPlan.id)}
                disabled={busy === nextPlan.id}
                className="w-full h-11 rounded-xl bg-white text-black hover:bg-white/90 font-bold uppercase tracking-[0.15em] text-xs"
              >
                {busy === nextPlan.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Adquirir plano {nextPlan.name} • {nextPlan.price}
              </Button>
              {isPending && (
                <p className="text-[11px] text-status-warning">
                  Pedido em análise pelo administrador.
                </p>
              )}
            </div>
          );
        })()}

        {PLANS.map((p) => {
          const Icon = ICONS[p.id];
          const isCurrent = p.id === currentPlan;

          return (
            <div
              key={p.id}
              className={cn(
                "rounded-2xl p-5 space-y-4 border transition-colors",
                isCurrent ? "glass-strong border-white/25" : "glass border-white/10"
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
                <div className="text-right shrink-0">
                  <p className="font-mono text-base font-bold leading-none">{p.price}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{p.priceNote}</p>
                </div>
              </div>

              <div className="flex items-center justify-end">
                {isCurrent && (
                  <span className="text-[10px] uppercase tracking-[0.2em] bg-white text-black rounded-full px-2 py-1 font-bold">
                    Atual
                  </span>
                )}
              </div>

              <ul className="space-y-1.5">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-status-active shrink-0" />
                    {perk}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
                  <div>
                    <p className="font-bold leading-tight">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.tagline}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-base font-bold leading-none">{p.price}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{p.priceNote}</p>
                </div>
              </div>

              <div className="flex items-center justify-end">
                {isCurrent && (
                  <span className="text-[10px] uppercase tracking-[0.2em] bg-white text-black rounded-full px-2 py-1 font-bold">
                    Atual
                  </span>
                )}
              </div>

              <ul className="space-y-1.5">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-status-active shrink-0" />
                    {perk}
                  </li>
                ))}
              </ul>

              {isAvailable && nextPlan && (
                <div className="space-y-2">
                  <Button
                    onClick={() => request(nextPlan.id)}
                    disabled={busy === nextPlan.id}
                    className="w-full h-11 rounded-xl bg-white text-black hover:bg-white/90 font-bold uppercase tracking-[0.15em] text-xs"
                  >
                    {busy === nextPlan.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Adquirir plano {nextPlan.name} • {nextPlan.price}
                  </Button>

                  {isPending && (
                    <p className="text-[11px] text-status-warning">
                      Pedido em análise pelo administrador.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
