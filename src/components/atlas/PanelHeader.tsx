import { ShieldCheck } from "lucide-react";
import { NotificationBell } from "./NotificationBell";

/**
 * Cabeçalho fixo do painel.
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

      <NotificationBell />
    </header>
  );
}
