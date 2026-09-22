import { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useKey } from "@/lib/key-context";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cabeçalho fixo do painel.
 */
export function PanelHeader() {
  const navigate = useNavigate();
  const { adminPreview, closeAdminPanel } = useKey();
  const [version, setVersion] = useState("1.0");

  useEffect(() => {
    let mounted = true;
    const loadVersion = async () => {
      const { data, error } = await supabase.rpc("get_app_version");
      if (mounted && !error && data) setVersion(String(data));
    };
    void loadVersion();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl glass-strong flex items-center justify-center">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <p className="vip-eyebrow">Painel</p>
          <h1 className="vip-title text-lg leading-none">Atlas VIP</h1>
          <p className="text-[10px] text-muted-foreground mt-1">Versão {version}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
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
