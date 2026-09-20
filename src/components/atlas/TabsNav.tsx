import { LayoutGrid, MessageCircle, SlidersHorizontal, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export type AtlasTab = "funcoes" | "ajustes" | "perfil" | "suporte";

const TABS: { id: AtlasTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "funcoes", label: "Funções", icon: LayoutGrid },
  { id: "ajustes", label: "Ajustes", icon: SlidersHorizontal },
  { id: "perfil", label: "Perfil", icon: UserRound },
  { id: "suporte", label: "Suporte", icon: MessageCircle },
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
      className="glass-strong rounded-2xl p-1 grid grid-cols-4 gap-1"
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
              "h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-all",
              active
                ? "bg-white text-black shadow-glow"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
