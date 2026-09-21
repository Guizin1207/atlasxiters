import { ArrowLeft, ShieldCheck, Menu } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useKey } from "@/lib/key-context";

/**
 * Cabeçalho fixo do painel.
 */
export function PanelHeader({ onOpenRecentes }: { onOpenRecentes?: () => void }) {
  const navigate = useNavigate();
  const { adminPreview, closeAdminPanel } = useKey();

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

      <div className="flex items-center gap-2">
        {onOpenRecentes && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Abrir conversas recentes"
            onClick={onOpenRecentes}
            className="h-10 w-10 rounded-2xl glass hover:bg-white/10"
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}

      {adminPreview ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            closeAdminPanel();
            navigate("/admin", { replace: true });
          }}
          className="rounded-xl glass hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Admin
        </Button>
      ) : (
        <NotificationBell />
      )}
      </div>
    </header>
  );
}
