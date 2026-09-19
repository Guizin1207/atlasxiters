/**
 * Catálogo de funções do painel, carregado do Lovable Cloud.
 * Admin usa a senha mestra (vê inclusive as ocultas); usuário usa a chave.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FALLBACK_FUNCTIONS,
  mapPanelFunction,
  type AtlasFunction,
  type PanelFunctionRow,
} from "@/lib/atlas-functions";

export const FUNCTIONS_CHANGED_EVENT = "atlas:functions-changed";

export function emitFunctionsChanged() {
  window.dispatchEvent(new Event(FUNCTIONS_CHANGED_EVENT));
}

type Source = { key: string } | { password: string };

export function usePanelFunctions(source: Source | null) {
  const [functions, setFunctions] = useState<AtlasFunction[]>(FALLBACK_FUNCTIONS);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!source) return;
    const res =
      "password" in source
        ? await supabase.rpc("admin_list_panel_functions", { _password: source.password })
        : await supabase.rpc("list_panel_functions", { _key: source.key });

    if (res.error || !Array.isArray(res.data)) {
      setOffline(true);
      setFunctions(FALLBACK_FUNCTIONS);
    } else {
      setOffline(false);
      setFunctions((res.data as unknown as PanelFunctionRow[]).map(mapPanelFunction));
    }
    setLoading(false);
  }, [source && "password" in source ? source.password : source?.key]);

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener(FUNCTIONS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FUNCTIONS_CHANGED_EVENT, onChange);
  }, [load]);

  return { functions, loading, offline, reload: load };
}
