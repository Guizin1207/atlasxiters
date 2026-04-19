/**
 * Polling do status global de manutenção.
 * Por padrão, 10s.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MaintenanceState = {
  enabled: boolean;
  message: string;
};

export function useMaintenance(intervalMs = 10_000) {
  const [state, setState] = useState<MaintenanceState>({ enabled: false, message: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchOnce = async () => {
      const { data, error } = await supabase.rpc("get_maintenance");
      if (!mounted || error) return;
      const obj = (data ?? {}) as { enabled?: boolean; message?: string };
      setState({ enabled: !!obj.enabled, message: obj.message ?? "" });
      setLoading(false);
    };
    fetchOnce();
    const id = setInterval(fetchOnce, intervalMs);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { ...state, loading };
}
