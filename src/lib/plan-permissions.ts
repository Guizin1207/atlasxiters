import type { PlanId } from "@/lib/atlas-config";

export type AtlasFeature = "default" | "moreHeadshot" | "moreControl" | "rush" | "awm" | "unlimitedChat";

export type AtlasPlanPermissions = {
  canUseDefault: boolean;
  canUseMoreHeadshot: boolean;
  canUseMoreControl: boolean;
  canUseRush: boolean;
  canUseAwm: boolean;
  unlimitedChat: boolean;
  chatLimit: number | null;
};

const normalizePlan = (plan?: string | null): PlanId => {
  const value = String(plan ?? "basic").toLowerCase() as PlanId;
  return ["demo", "basic", "pro", "master", "bronze", "esmeralda", "rubi", "atlas"].includes(value)
    ? value
    : "basic";
};

export function getPlanPermissions(plan?: string | null, isMasterKey = false): AtlasPlanPermissions {
  if (isMasterKey || normalizePlan(plan) === "master") {
    return {
      canUseDefault: true,
      canUseMoreHeadshot: true,
      canUseMoreControl: true,
      canUseRush: true,
      canUseAwm: true,
      unlimitedChat: true,
      chatLimit: null,
    };
  }

  const current = normalizePlan(plan);
  const proLike = ["pro", "bronze", "esmeralda", "rubi", "atlas"].includes(current);

  return {
    canUseDefault: true,
    canUseMoreHeadshot: proLike,
    canUseMoreControl: proLike,
    canUseRush: proLike,
    canUseAwm: false,
    unlimitedChat: false,
    chatLimit: 20,
  };
}

export function featureRequiredPlan(feature: AtlasFeature): "Basic" | "Pro" | "Master" {
  if (feature === "default") return "Basic";
  if (feature === "moreHeadshot" || feature === "moreControl" || feature === "rush") return "Pro";
  return "Master";
}
