/**
 * Aba "Planos" — mostra o plano atual e permite adquirir um plano pago.
 * O botão de aquisição abre o WhatsApp com a mensagem pronta.
 */

import { Check, Crown, Copy, FlaskConical, QrCode, Sparkles, Zap } from "lucide-react";
import { useKey } from "@/lib/key-context";
import { PLANS, getPlan, type PlanId } from "@/lib/atlas-config";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

const ICONS: Record<PlanId, typeof Zap> = {
  demo: FlaskConical,
  basic: Zap,
  pro: Sparkles,
  master: Crown,
};

export function PlanosTab({ embedded = false }: { embedded?: boolean } = {}) {
  const { keyData } = useKey();
  const [paying, setPaying] = useState<PlanId | null>(null);
  const [pixPlan, setPixPlan] = useState<PlanId | null>(null);

  const startPayment = (plan: PlanId) => {
    if (plan === "demo") return;
    setPaying(plan);
    setPixPlan(plan);
    setPaying(null);
  };

  const pixKey = "38998816357";
  const pixPayload = pixKey;

  const copyPixKey = async () => {
    await navigator.clipboard.writeText(pixKey);
    toast.success("Chave Pix copiada");
  };

  const copyPixCode = async () => {
    await navigator.clipboard.writeText(pixPayload);
    toast.success("Pix Copia e Cola copiado");
  };

  const currentPlan: PlanId = keyData?.is_master
    ? "master"
    : ((keyData?.plan as PlanId) ?? "basic");
  const isDemo = currentPlan === "demo";
  const demoHasExpiry = Boolean(keyData?.expires_at);
  const demoTagline = demoHasExpiry ? "Acesso demo com prazo" : "Acesso demo ilimitado";

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
        {PLANS.map((p) => {
          const Icon = ICONS[p.id];
          const isCurrent = p.id === currentPlan;
          const planIdx = p.id === "basic" ? 1 : p.id === "pro" ? 2 : 3;
          const currentIdx = currentPlan === "demo" ? 0 : currentPlan === "basic" ? 1 : currentPlan === "pro" ? 2 : 3;
          const isAvailable = isDemo ? true : planIdx > currentIdx;

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

              {isAvailable && (
                <button
                  type="button"
                  onClick={() => startPayment(p.id)}
                  disabled={paying !== null}
                  className="w-full h-11 rounded-xl bg-white text-black hover:bg-white/90 disabled:opacity-60 disabled:cursor-wait font-bold uppercase tracking-[0.12em] text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  {paying === p.id ? "Abrindo Pix…" : "Pagar com Pix"}
                </button>
              )}
            </div>
          );
        })}
      </div>


      {pixPlan && (
        <div className="glass-strong rounded-2xl p-5 space-y-4 border border-white/15">
          <div>
            <p className="vip-eyebrow mb-1">Pagamento via Pix</p>
            <p className="font-bold">{getPlan(pixPlan).name} — {getPlan(pixPlan).price}</p>
            <p className="text-xs text-muted-foreground mt-1">Copie a chave ou use o QR Code para pagar. Depois envie o comprovante.</p>
          </div>
          <div className="rounded-xl bg-black/20 border border-white/10 p-3 flex items-center justify-between gap-3">
            <span className="font-mono text-sm break-all">{pixKey}</span>
            <button type="button" onClick={copyPixKey} className="shrink-0 h-9 px-3 rounded-lg bg-white text-black text-xs font-bold flex items-center gap-2">
              <Copy className="w-3.5 h-3.5" /> Copiar
            </button>
          </div>
          <div className="rounded-xl border border-white/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em]"><QrCode className="w-4 h-4" /> Pix Copia e Cola</div>
            <p className="text-[11px] text-muted-foreground break-all">{pixPayload}</p>
            <button type="button" onClick={copyPixCode} className="w-full h-10 rounded-lg bg-white text-black text-xs font-bold">Copiar chave Pix</button>
          </div>
          <div className="rounded-xl border border-white/10 p-4 flex flex-col items-center gap-3">
            <img src={`https://quickchart.io/qr?text=${encodeURIComponent(pixKey)}&size=260`} alt="QR Code da chave Pix" className="w-52 h-52 rounded-lg bg-white p-2" />
            <p className="text-[11px] text-muted-foreground text-center">Aponte a câmera do banco para este QR Code.</p>
          </div>
          <a href="https://wa.me/5538998816357" target="_blank" rel="noreferrer" className="w-full h-11 rounded-xl border border-white/15 flex items-center justify-center text-xs font-bold uppercase tracking-[0.12em]">
            Enviar comprovante
          </a>
        </div>
      )}

    </section>
  );
}
