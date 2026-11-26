import { Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Card de função. Estado controlado pelo pai (persistido em key_settings). */
export function FunctionCard({
  icon: Icon,
  name,
  tag,
  on,
  locked,
  lockLabel,
  onToggle,
}: {
  icon: LucideIcon;
  name: string;
  tag: string;
  on: boolean;
  locked?: boolean;
  lockLabel?: string;
  onToggle: () => void;
}) {
  const active = on && !locked;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={cn(
        "atlas-hud-card group relative text-left rounded-2xl p-4 h-32 flex flex-col justify-between transition-all duration-200 overflow-hidden",
        "glass hover:border-atlas-accent/30 hover:bg-atlas-accent/[0.055] active:scale-[0.98]",
        active && "border-atlas-accent/45 bg-atlas-accent/[0.09] shadow-atlas-active",
        locked && "opacity-55 saturate-50"
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center border transition-all",
            active
              ? "bg-atlas-accent text-primary-foreground border-atlas-accent-bright/40 shadow-glow"
              : "bg-secondary/80 text-foreground/85 border-border/10 group-hover:border-atlas-accent/20 group-hover:text-atlas-accent"
          )}
        >
          {locked ? <Lock className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
        </div>
        {locked ? (
          <span className="text-[9px] uppercase tracking-[0.15em] font-bold px-2 py-0.5 rounded-md border border-border/15 bg-secondary/60 text-muted-foreground">
            {lockLabel}
          </span>
        ) : (
          <span
            className={cn(
              "status-dot mt-1 mr-1",
              active ? "bg-atlas-accent shadow-[0_0_10px_hsl(var(--atlas-accent)/0.85)] animate-pulse-soft" : "bg-muted-foreground/30"
            )}
            aria-hidden
          />
        )}
      </div>

      <div>
        <p
          className={cn(
            "text-[9px] uppercase tracking-[0.2em] mb-1.5",
            active ? "text-atlas-accent" : "text-muted-foreground"
          )}
        >
          {tag}
        </p>
        <p className={cn("font-bold text-sm leading-tight", active && "text-atlas-accent-bright")}>{name}</p>
      </div>
    </button>
  );
}
