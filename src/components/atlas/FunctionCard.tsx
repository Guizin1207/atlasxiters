import { Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Card de função. Estado controlado pelo pai (persistido em key_settings).
 */
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
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={cn(
        "group relative text-left rounded-2xl p-4 h-32 flex flex-col justify-between transition-all overflow-hidden",
        "glass hover:bg-white/[0.07] active:scale-[0.98]",
        on && !locked && "bg-white text-black hover:bg-white",
        locked && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
            on && !locked ? "bg-black/10" : "bg-white/10"
          )}
        >
          {locked ? <Lock className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
        </div>
        {locked ? (
          <span className="text-[9px] uppercase tracking-[0.15em] font-bold px-2 py-0.5 rounded-md border border-white/15 text-muted-foreground">
            {lockLabel}
          </span>
        ) : (
          <span
            className={cn(
              "status-dot",
              on ? "bg-status-active animate-pulse-soft" : "bg-white/20"
            )}
            aria-hidden
          />
        )}
      </div>

      <div>
        <p
          className={cn(
            "text-[10px] uppercase tracking-[0.2em] mb-1",
            on && !locked ? "text-black/60" : "text-muted-foreground"
          )}
        >
          {tag}
        </p>
        <p className="font-bold text-sm leading-tight">{name}</p>
      </div>
    </button>
  );
}
