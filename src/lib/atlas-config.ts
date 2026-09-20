/**
 * Configurações fixas do Atlas VIP.
 */
export const SUPPORT_WHATSAPP = "5538998816357";
const SUPPORT_MESSAGE = "Olá! Preciso de ajuda com o Atlas VIP.";
export const SUPPORT_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`;
export const SUPPORT_LABEL = "Falar com o suporte";

export type PlanId = "basic" | "pro" | "master";

export type PlanInfo = {
  id: PlanId;
  name: string;
  days: number | null; // null = vitalício
  tagline: string;
  price: string;
  priceNote: string;
  perks: string[];
};

export const PLANS: PlanInfo[] = [
  {
    id: "basic",
    name: "Basic",
    days: 30,
    tagline: "30 dias de acesso",
    price: "R$ 39,99",
    priceNote: "por mês",
    perks: ["Funções essenciais", "1 dispositivo", "Suporte padrão"],
  },
  {
    id: "pro",
    name: "Pro",
    days: 90,
    tagline: "90 dias de acesso",
    price: "R$ 85,99",
    priceNote: "a cada 3 meses",
    perks: ["Todas as funções", "1 dispositivo", "Suporte prioritário"],
  },
  {
    id: "master",
    name: "Master",
    days: null,
    tagline: "Acesso vitalício",
    price: "R$ 149,99",
    priceNote: "pagamento único",
    perks: ["Todas as funções", "Sem expiração", "Suporte VIP"],
  },
];

export const PLAN_ORDER: PlanId[] = ["basic", "pro", "master"];

export function getPlan(id?: string | null): PlanInfo {
  return PLANS.find((p) => p.id === (id ?? "basic")) ?? PLANS[0];
}

/** Link do WhatsApp já com a mensagem do pedido de upgrade. */
export function upgradeWhatsAppUrl(key: string, plan: PlanId) {
  const p = getPlan(plan);
  const msg = `Olá! Quero fazer upgrade para o plano ${p.name} — ${p.price} (${p.priceNote}).\\nMinha chave: ${key}`;
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}
