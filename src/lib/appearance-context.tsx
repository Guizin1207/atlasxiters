import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_APPEARANCE, normalizeAppearance, type AppAppearance } from "./app-appearance";

const AppearanceContext = createContext({ appearance: DEFAULT_APPEARANCE, loading: false, error: "", refresh: async () => {}, apply: (_value: AppAppearance) => {} });
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await supabase.rpc("get_app_appearance");
      if (result.error) throw result.error;
      setAppearance(normalizeAppearance(result.data));
      setError("");
    } catch { setError("Não foi possível carregar a aparência atual."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    // Read only on app entry, return to foreground and occasional refresh; no AI calls.
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60000);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);
  useEffect(() => { document.documentElement.dataset.holiday = appearance.theme; }, [appearance.theme]);
  return <AppearanceContext.Provider value={{ appearance, loading, error, refresh, apply: setAppearance }}>{children}</AppearanceContext.Provider>;
}
export const useAppearance = () => useContext(AppearanceContext);
export function AppLogo({ className = "h-8 w-8" }: { className?: string }) {
  const { appearance } = useAppearance();
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [appearance.logo]);
  return appearance.logo && !failed
    ? <img src={appearance.logo} alt="Logo Atlas VIP" className={`${className} object-contain`} onError={() => setFailed(true)} />
    : <ShieldCheck className={className} />;
}