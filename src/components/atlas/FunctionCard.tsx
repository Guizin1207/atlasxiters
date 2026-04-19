import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Card de função: clique alterna estado visual on/off (apenas UI nesta fase).
 */
export function FunctionCard({
  icon: Icon,
  name,
  tag,
}: {
  icon: LucideIcon;
  name: string;
  tag: string;
}) {
  const [on, setOn] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      aria-pressed={on}
      className={cn(
        "group relative text-left rounded-2xl p-4 h-32 flex flex-col justify-between transition-all overflow-hidden",
        "glass hover:bg-white/[0.07] active:scale-[0.98]",
        on && "bg-white text-black hover:bg-white"
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
            on ? "bg-black/10" : "bg-white/10"
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
        <span
          className={cn(
            "status-dot",
            on ? "bg-status-active animate-pulse-soft" : "bg-white/20"
          )}
          aria-hidden
        />
      </div>

      <div>
        <p
          className={cn(
            "text-[10px] uppercase tracking-[0.2em] mb-1",
            on ? "text-black/60" : "text-muted-foreground"
          )}
        >
          {tag}
        </p>
        <p className="font-bold text-sm leading-tight">{name}</p>
      </div>
    </button>
  );
}
