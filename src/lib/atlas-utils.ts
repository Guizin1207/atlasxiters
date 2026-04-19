import { Smartphone, Apple, Monitor, Laptop, HelpCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function getDeviceIcon(device: string | null | undefined): LucideIcon {
  if (!device) return HelpCircle;
  const d = device.toLowerCase();
  if (d.includes("android")) return Smartphone;
  if (d.includes("ios") || d.includes("iphone") || d.includes("ipad")) return Apple;
  if (d.includes("mac")) return Apple;
  if (d.includes("windows")) return Monitor;
  if (d.includes("linux")) return Laptop;
  return HelpCircle;
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return key;
  const head = key.slice(0, 4);
  const tail = key.slice(-4);
  return `${head} •••• ${tail}`;
}

/** Retorna ms restantes até `iso`. Negativo se já passou. */
export function msUntil(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return new Date(iso).getTime() - Date.now();
}

/** Formata ms como "Xd Yh Zm Ws". Para infinito, retorna "∞". */
export function formatCountdown(ms: number): string {
  if (!isFinite(ms)) return "∞";
  if (ms <= 0) return "0d 0h 0m 0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}
