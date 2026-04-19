import {
  Crosshair,
  Eye,
  Zap,
  Shield,
  Radar,
  Sparkles,
  Wand2,
  Gauge,
} from "lucide-react";
import { FunctionCard } from "./FunctionCard";

/**
 * Aba "Funções" — apenas UI (sem ação real nesta fase).
 * Cada FunctionCard é um placeholder visual; ações reais virão depois.
 */
export function FuncoesTab() {
  return (
    <section aria-label="Funções disponíveis" className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="vip-eyebrow mb-1">Catálogo</p>
          <h2 className="text-xl font-bold">Funções premium</h2>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {FUNCTIONS.length} disponíveis
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FUNCTIONS.map((f) => (
          <FunctionCard key={f.id} {...f} />
        ))}
      </div>
    </section>
  );
}

const FUNCTIONS = [
  { id: "aim", icon: Crosshair, name: "Aim Assist", tag: "Combate" },
  { id: "esp", icon: Eye, name: "ESP", tag: "Visão" },
  { id: "speed", icon: Zap, name: "Velocidade", tag: "Mobilidade" },
  { id: "shield", icon: Shield, name: "Anti-Recoil", tag: "Combate" },
  { id: "radar", icon: Radar, name: "Radar", tag: "Visão" },
  { id: "skin", icon: Sparkles, name: "Skin Changer", tag: "Visual" },
  { id: "magic", icon: Wand2, name: "Auto Loot", tag: "Utilidade" },
  { id: "gauge", icon: Gauge, name: "FPS Boost", tag: "Performance" },
] as const;
