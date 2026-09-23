import { LayoutGrid, SlidersHorizontal, UserRound, Gift, Sparkles, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export type AtlasTab = "funcoes" | "sensi" | "planos" | "ajustes" | "recompensa" | "perfil";

const TABS: { id: AtlasTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "funcoes", label: "Funções", icon: LayoutGrid },
  { id: "sensi", label: "IA Sensi", icon: Sparkles },
  { id: "planos", label: "Planos", icon: Crown },
  { id: "ajustes", label: "Ajustes", icon: SlidersHorizontal },
  { id: "recompensa", label: "Recompensa", icon: Gift },
  { id: "perfil", label: "Perfil", icon: UserRound },
];

export function TabsNav({ value, onChange }: { value: AtlasTab; onChange: (t: AtlasTab) => void }) {
  return (
    <nav role="tablist" aria-label="Seções do painel" className="glass-strong rounded-2xl p-1 grid grid-cols-3 gap-1 w-full overflow-hidden">
      {TABS.map((t) => {
        const active = value === t.id;
        const Icon = t.icon;
        return (
          <button key={t.id} role="tab" aria-selected={active} onClick={() => onChange(t.id)}
            className={cn(
              "h-11 w-full rounded-xl flex flex-col items-center justify-center gap-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] transition-all",
              active ? "bg-white text-black shadow-glow" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}>
            <Icon className="w-3.5 h-3.5" />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
