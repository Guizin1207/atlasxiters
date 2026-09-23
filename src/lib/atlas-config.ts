/**
 * Configurações fixas do Atlas VIP.
 */
export const SUPPORT_WHATSAPP = "5538998816357";
const SUPPORT_MESSAGE = "Olá! Preciso de ajuda com o Atlas VIP.";
export const SUPPORT_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`;
export const SUPPORT_LABEL = "Falar com o suporte";

export type PlanId = "demo" | "basic" | "pro" | "master" | "bronze" | "esmeralda" | "rubi" | "atlas";

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
  { id: "basic", name: "Basic", days: 30, tagline: "30 dias de acesso", price: "R$ 19,90", priceNote: "por mês", perks: ["Funções essenciais", "1 dispositivo", "IA básica", "Suporte padrão"] },
  { id: "pro", name: "Pro", days: 60, tagline: "60 dias de acesso", price: "R$ 34,90", priceNote: "a cada 2 meses", perks: ["Todas as funções", "1 dispositivo", "IA aprimorada", "Suporte prioritário"] },
  { id: "master", name: "Master", days: 90, tagline: "90 dias de acesso", price: "R$ 49,90", priceNote: "a cada 3 meses", perks: ["Todas as funções", "Sem expiração", "IA completa", "Suporte VIP"] },
  { id: "bronze", name: "VIP Bronze", days: 30, tagline: "VIP por 30 dias", price: "Sob consulta", priceNote: "pelo suporte", perks: ["Benefícios VIP", "Pacote Sensi Pro", "IA aprimorada", "Suporte prioritário"] },
  { id: "esmeralda", name: "VIP Esmeralda", days: 60, tagline: "VIP por 60 dias", price: "R$ 54,90", priceNote: "pelo suporte", perks: ["Benefícios VIP+", "Sensi Pro avançada", "IA mais completa", "Suporte prioritário"] },
  { id: "rubi", name: "VIP Rubi", days: 90, tagline: "VIP por 90 dias", price: "R$ 79,90", priceNote: "pelo suporte", perks: ["Benefícios premium", "Configs Sensi avançadas", "IA completa", "Atendimento VIP"] },
  { id: "atlas", name: "VIP Atlas", days: 180, tagline: "VIP por 180 dias", price: "R$ 139,90", priceNote: "pelo suporte", perks: ["Pacote premium completo", "Sensi Pro+", "IA completa+", "Atendimento VIP exclusivo"] },
];

export const PLAN_ORDER: PlanId[] = ["demo", "basic", "pro", "bronze", "esmeralda", "rubi", "atlas", "master"];

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
