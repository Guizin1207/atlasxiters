/**
 * Configurações fixas do Atlas VIP.
 */
export const SUPPORT_WHATSAPP = "5538998816357";
const SUPPORT_MESSAGE = "Olá! Preciso de ajuda com o Atlas VIP.";
export const SUPPORT_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`;
export const SUPPORT_LABEL = "Falar com o suporte";

export type PlanId = "demo" | "basic" | "pro" | "master";

export type PlanInfo = {
  id: PlanId;
  name: string;
  days: number | null;
  tagline: string;
  price: string;
  priceNote: string;
  perks: string[];
};

export const PLANS: PlanInfo[] = [
  { id: "basic", name: "Basic", days: 30, tagline: "30 dias de acesso", price: "R$ 1,00", priceNote: "valor de teste", perks: ["Funções essenciais", "1 dispositivo", "Suporte padrão"] },
  { id: "pro", name: "Pro", days: 90, tagline: "90 dias de acesso", price: "R$ 85,99", priceNote: "a cada 3 meses", perks: ["Todas as funções", "1 dispositivo", "Suporte prioritário"] },
  { id: "master", name: "Master", days: null, tagline: "Acesso vitalício", price: "R$ 149,99", priceNote: "pagamento único", perks: ["Todas as funções", "Sem expiração", "Suporte VIP"] },
];

export const PLAN_ORDER: PlanId[] = ["demo", "basic", "pro", "master"];

const PLAN_FALLBACK: PlanInfo = { id: "demo", name: "Demo", days: null, tagline: "Acesso demo ilimitado", price: "Grátis", priceNote: "acesso demo", perks: ["Acesso de demonstração", "Sem expiração"] };

export function getPlan(id?: string | null): PlanInfo {
  if (id === "demo") return PLAN_FALLBACK;
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function upgradeWhatsAppUrl(key: string, plan: PlanId, currentPlan?: PlanId) {
  const p = getPlan(plan);
  const isDemo = currentPlan === "demo";
  const intro = isDemo
    ? `Olá! Quero adquirir o plano ${p.name} — ${p.price} (${p.priceNote}).`
    : `Olá! Quero adquirir o plano ${p.name} — ${p.price} (${p.priceNote}).`;
  const keyLine = isDemo ? "" : `\\nMinha chave: ${key}`;
  const msg = `${intro}${keyLine}`;
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}
