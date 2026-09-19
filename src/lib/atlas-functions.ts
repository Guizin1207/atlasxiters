/**
 * Catálogo de funções do painel + liberação por plano.
 */
import {
  Crosshair,
  Eye,
  Zap,
  Shield,
  Radar,
  Sparkles,
  Wand2,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { PLAN_ORDER, type PlanId } from "@/lib/atlas-config";

export type AtlasFunction = {
  id: string;
  icon: LucideIcon;
  name: string;
  tag: string;
  minPlan: PlanId;
};

export const ATLAS_FUNCTIONS: AtlasFunction[] = [
  { id: "aim", icon: Crosshair, name: "Aim Assist", tag: "Combate", minPlan: "basic" },
  { id: "esp", icon: Eye, name: "ESP", tag: "Visão", minPlan: "basic" },
  { id: "speed", icon: Zap, name: "Velocidade", tag: "Mobilidade", minPlan: "basic" },
  { id: "shield", icon: Shield, name: "Anti-Recoil", tag: "Combate", minPlan: "pro" },
  { id: "radar", icon: Radar, name: "Radar", tag: "Visão", minPlan: "pro" },
  { id: "gauge", icon: Gauge, name: "FPS Boost", tag: "Performance", minPlan: "pro" },
  { id: "skin", icon: Sparkles, name: "Skin Changer", tag: "Visual", minPlan: "master" },
  { id: "magic", icon: Wand2, name: "Auto Loot", tag: "Utilidade", minPlan: "master" },
];

/** true se o plano atual libera a função. */
export function planAllows(plan: string | null | undefined, minPlan: PlanId) {
  const cur = PLAN_ORDER.indexOf((plan ?? "basic") as PlanId);
  const need = PLAN_ORDER.indexOf(minPlan);
  return (cur < 0 ? 0 : cur) >= need;
}
