/**
 * Ícones permitidos nas funções do painel (mesma lista validada no banco).
 */
import {
  Box,
  Cpu,
  Crosshair,
  Eye,
  Gamepad2,
  Gauge,
  Radar,
  Shield,
  Target,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const PANEL_ICONS: Record<string, LucideIcon> = {
  crosshair: Crosshair,
  eye: Eye,
  zap: Zap,
  shield: Shield,
  radar: Radar,
  gauge: Gauge,
  "wand-2": Wand2,
  box: Box,
  target: Target,
  cpu: Cpu,
  "gamepad-2": Gamepad2,
};

export const PANEL_ICON_IDS = Object.keys(PANEL_ICONS);

export function getPanelIcon(icon: string | null | undefined): LucideIcon {
  return PANEL_ICONS[(icon ?? "").toLowerCase()] ?? Wand2;
}
