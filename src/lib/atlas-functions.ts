/**
 * Catálogo de funções do painel + liberação por plano.
 * O catálogo real vive no Lovable Cloud (tabela panel_functions);
 * a lista abaixo é apenas fallback de leitura quando a nuvem não responde.
 */
import { PLAN_ORDER, type PlanId } from "@/lib/atlas-config";
import { getPanelIcon } from "@/lib/panel-icons";

export type AtlasFunction = {
  id: string;
  /** Nome do ícone (ver src/lib/panel-icons.ts). */
  icon: string;
  name: string;
  tag: string;
  minPlan: PlanId;
  sortOrder: number;
  visible: boolean;
};

export const FALLBACK_FUNCTIONS: AtlasFunction[] = [
  { id: "aim", icon: "crosshair", name: "Aim Assist", tag: "Combate", minPlan: "basic", sortOrder: 10, visible: true },
  { id: "esp", icon: "eye", name: "ESP", tag: "Visão", minPlan: "basic", sortOrder: 20, visible: true },
  { id: "speed", icon: "zap", name: "Velocidade", tag: "Mobilidade", minPlan: "basic", sortOrder: 30, visible: true },
  { id: "shield", icon: "shield", name: "Anti-Recoil", tag: "Combate", minPlan: "pro", sortOrder: 40, visible: true },
  { id: "radar", icon: "radar", name: "Radar", tag: "Visão", minPlan: "pro", sortOrder: 50, visible: true },
  { id: "gauge", icon: "gauge", name: "FPS Boost", tag: "Performance", minPlan: "pro", sortOrder: 60, visible: true },
  { id: "skin", icon: "wand-2", name: "Skin Changer", tag: "Visual", minPlan: "master", sortOrder: 70, visible: true },
  { id: "magic", icon: "box", name: "Auto Loot", tag: "Utilidade", minPlan: "master", sortOrder: 80, visible: true },
];

/** Linha crua vinda do banco. */
export type PanelFunctionRow = {
  id: string;
  name: string;
  tag: string;
  min_plan: string;
  icon: string;
  sort_order: number;
  visible: boolean;
};

export function mapPanelFunction(row: PanelFunctionRow): AtlasFunction {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    minPlan: (["basic", "pro", "master"].includes(row.min_plan) ? row.min_plan : "basic") as PlanId,
    icon: row.icon,
    sortOrder: row.sort_order ?? 0,
    visible: row.visible !== false,
  };
}

export { getPanelIcon };

/**
 * true se o plano atual libera a função.
 * O acesso demo equivale ao Basic: mostra o painel funcionando sem liberar
 * os planos pagos.
 */
export function planAllows(plan: string | null | undefined, minPlan: PlanId) {
  const current = (plan ?? "basic") as PlanId;
  const cur = PLAN_ORDER.indexOf(current === "demo" ? "basic" : current);
  const need = PLAN_ORDER.indexOf(minPlan);
  return (cur < 0 ? 0 : cur) >= need;
}
