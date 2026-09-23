import { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useKey } from "@/lib/key-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export function PanelHeader() {
  const navigate = useNavigate();
  const { keyData, adminPreview, closeAdminPanel } = useKey();
  const { profile, user } = useAuth();
  const [version, setVersion] = useState("1.0");

  useEffect(() => {
    let mounted = true;
    const loadVersion = async () => {
      const { data, error } = await supabase.rpc("get_app_version");
      if (mounted && !error && data) setVersion(String(data));
    };
    void loadVersion();
    return () => { mounted = false; };
  }, []);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0];

  return (
    <header className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-2xl glass-strong flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="vip-eyebrow">Painel</p>
          <h1 className="vip-title text-lg leading-none">Atlas VIP</h1>
          <p className="text-[10px] text-muted-foreground mt-1">Versão {version}</p>
          {!adminPreview && displayName && (
            <p className="text-[10px] font-semibold text-foreground/80 mt-0.5 truncate max-w-[190px]">
              {displayName}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {adminPreview ? (
          <Button variant="ghost" size="sm" onClick={() => { closeAdminPanel(); navigate("/admin", { replace: true }); }} className="rounded-xl glass hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" /> Admin
          </Button>
        ) : <NotificationBell />}
      </div>
    </header>
  );
}
