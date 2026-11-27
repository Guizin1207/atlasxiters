import { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useKey } from "@/lib/key-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { AppLogo, HolidaySignature } from "@/lib/appearance-context";

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
    <header className="relative flex items-center justify-between mb-6 after:absolute after:-bottom-3 after:left-0 after:h-px after:w-16 after:bg-atlas-accent/50 after:content-['']">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-11 h-11 rounded-2xl glass-strong flex items-center justify-center shrink-0 border-atlas-accent/25 shadow-glow">
          <span className="absolute right-1.5 top-1.5 h-1 w-1 rounded-full bg-atlas-accent shadow-glow" aria-hidden />
          <AppLogo className="w-8 h-8 text-atlas-accent" />
        </div>
        <div className="min-w-0">
          <p className="vip-eyebrow text-atlas-accent/75">Painel tático</p>
          <h1 className="vip-title text-lg leading-none">Atlas <span className="text-atlas-accent">VIP</span></h1>
          <p className="text-[10px] text-muted-foreground mt-1">Versão {version}</p>
          <HolidaySignature />
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
