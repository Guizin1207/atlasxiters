import { LayoutGrid, SlidersHorizontal, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export type AtlasTab = "funcoes" | "ajustes" | "perfil";

const TABS: { id: AtlasTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "funcoes", label: "Funções", icon: LayoutGrid },
  { id: "ajustes", label: "Ajustes", icon: SlidersHorizontal },
  { id: "perfil", label: "Perfil", icon: UserRound },
];

export function TabsNav({
  value,
  onChange,
}: {
  value: AtlasTab;
  onChange: (t: AtlasTab) => void;
}) {
  return (
    <nav
      role="tablist"
      aria-label="Seções do painel"
      className="glass-strong rounded-2xl p-1 grid grid-cols-3 gap-1"
    >
      {TABS.map((t) => {
        const active = value === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "h-11 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] transition-all",
              active
                ? "bg-white text-black shadow-glow"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
