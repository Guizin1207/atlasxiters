import { Bell, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Cabeçalho fixo do painel.
 * O sino é placeholder — Fase 3 conecta ao Realtime.
 */
export function PanelHeader() {
  return (
    <header className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl glass-strong flex items-center justify-center">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <p className="vip-eyebrow">Painel</p>
          <h1 className="vip-title text-lg leading-none">Atlas VIP</h1>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Notificações"
        className="w-10 h-10 rounded-2xl glass relative hover:bg-white/10"
      >
        <Bell className="w-4 h-4" />
        {/* badge de não-lidas (placeholder até Fase 3) */}
        <span
          aria-hidden
          className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-white/20"
        />
      </Button>
    </header>
  );
}
