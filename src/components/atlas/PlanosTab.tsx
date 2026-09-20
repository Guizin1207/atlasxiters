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
  const [pixPlan, setPixPlan] = useState<PlanId | null>(null);

  const startPayment = (plan: PlanId) => {
    if (plan === "demo") return;
    setPixPlan(plan);
    setTimeout(() => {
      document.getElementById("pix-payment")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  const pixKey = "38998816357";
  const merchantName = "ATLAS VIP";
  const merchantCity = "SAO PAULO";

  const crc16 = (value: string) => {
    let crc = 0xffff;
    for (let i = 0; i < value.length; i++) {
      crc ^= value.charCodeAt(i) << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  };

  const emv = (id: string, value: string) => id + value.length.toString().padStart(2, "0") + value;

  const makePixPayload = (plan: PlanId) => {
    const price = getPlan(plan).price.replace("R$ ", "").replace(".", "").replace(",", ".");
    const merchantAccount = emv("00", "BR.GOV.BCB.PIX") + emv("01", pixKey);
    const additional = emv("05", "ATLAS");
    const body =
      emv("00", "01") +
      emv("26", merchantAccount + additional) +
      emv("52", "0000") +
      emv("53", "986") +
      emv("54", price) +
      emv("58", "BR") +
      emv("59", merchantName) +
      emv("60", merchantCity);
    return body + "6304" + crc16(body + "6304");
  };

  const copyPixKey = async () => {
    await navigator.clipboard.writeText(pixKey);
    toast.success("Chave Pix copiada");
  };

  const copyPixCode = async () => {
    await navigator.clipboard.writeText(pixKey);
    toast.success("Chave Pix copiada");
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
                  className="w-full h-11 rounded-xl bg-white text-black hover:bg-white/90 disabled:opacity-60 disabled:cursor-wait font-bold uppercase tracking-[0.12em] text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  Pagar com Pix
                </button>
              )}
            </div>
          );
        })}
      </div>


      {pixPlan && (
        <div id="pix-payment" className="glass-strong rounded-2xl p-5 space-y-4 border border-white/15">
          <div>
            <p className="vip-eyebrow mb-1">Pagamento via Pix</p>
            <p className="font-bold">{getPlan(pixPlan).name} — {getPlan(pixPlan).price}</p>
            <p className="text-xs text-muted-foreground mt-1">Copie a chave ou use o QR Code para pagar. Depois envie o comprovante.</p>
          </div>
          <div className="rounded-xl border border-white/10 p-4 flex flex-col items-center gap-3">
            <p className="font-mono text-base font-bold">{pixKey}</p>
            <button type="button" onClick={copyPixKey} className="h-10 px-4 rounded-lg bg-white text-black text-xs font-bold">Copiar chave Pix</button>
          </div>
          <a href={`https://wa.me/5538998816357?text=${encodeURIComponent(`EBA! 🎉 Você fez sua compra na Atlas Store!\n\nAgora é só enviar o comprovante. Aguarde a aprovação do ADM; assim que possível, entraremos em contato com sua nova key.\n\nPlano: ${getPlan(pixPlan).name}\nValor: ${getPlan(pixPlan).price}`)}`} target="_blank" rel="noreferrer" className="w-full h-11 rounded-xl border border-white/15 flex items-center justify-center text-xs font-bold uppercase tracking-[0.12em]">
            EBA! Enviar comprovante
          </a>
        </div>
      )}

    </section>
  );
}
