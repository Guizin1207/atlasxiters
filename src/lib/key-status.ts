import type { KeyData } from "@/lib/key-context";

export type KeyStatus = "unused" | "active" | "expired" | "revoked";

export function getKeyStatus(k: KeyData): KeyStatus {
  if (k.revoked) return "revoked";
  if (!k.activated_at) return "unused";
  if (k.is_master || k.plan === "demo") return "active";
  if (k.expires_at && new Date(k.expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

export const STATUS_LABEL: Record<KeyStatus, string> = { unused: "Não usada", active: "Ativa", expired: "Expirada", revoked: "Desativada" };
export const STATUS_BADGE: Record<KeyStatus, string> = {
  unused: "bg-white/10 text-foreground border-white/15",
  active: "bg-status-active/15 text-status-active border-status-active/30",
  expired: "bg-status-danger/15 text-status-danger border-status-danger/30",
  revoked: "bg-white/5 text-muted-foreground border-white/10 line-through",
};
