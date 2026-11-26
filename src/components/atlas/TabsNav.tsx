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
    <nav role="tablist" aria-label="Seções do painel" className="glass-strong relative rounded-2xl p-1.5 grid grid-cols-3 gap-1 w-full overflow-hidden border-atlas-line/15">
      <span className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-atlas-accent/60 to-transparent" aria-hidden />
      {TABS.map((t) => {
        const active = value === t.id;
        const Icon = t.icon;
        return (
          <button key={t.id} role="tab" aria-selected={active} onClick={() => onChange(t.id)}
            className={cn(
              "relative h-11 w-full rounded-xl flex flex-col items-center justify-center gap-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] transition-all duration-200",
              active
                ? "bg-atlas-accent/15 text-atlas-accent-bright border border-atlas-accent/30 shadow-[inset_0_1px_0_hsl(var(--atlas-accent-bright)/0.12)]"
                : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-atlas-accent/5 hover:border-atlas-accent/10"
            )}>
            <Icon className={cn("w-3.5 h-3.5", active && "drop-shadow-[0_0_6px_hsl(var(--atlas-accent)/0.55)]")} />
            <span>{t.label}</span>
            {active && <span className="absolute bottom-0.5 h-px w-5 bg-atlas-accent" aria-hidden />}
          </button>
        );
      })}
    </nav>
  );
}
