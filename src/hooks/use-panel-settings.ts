/**
 * Sincroniza preferências do usuário (jsonb) por chave.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useKey } from "@/lib/key-context";

export type PanelSettings = {
  notifications?: boolean;
  haptics?: boolean;
  reducedMotion?: boolean;
  /** Funções ativadas pelo usuário (persistem entre abas/sessões). */
  functions?: Record<string, boolean>;
  /** Última sensibilidade gerada. */
  sensi?: unknown;
};

const DEFAULTS: PanelSettings = {
  notifications: true,
  haptics: true,
  reducedMotion: false,
};

export function usePanelSettings() {
  const { keyData } = useKey();
  const [settings, setSettings] = useState<PanelSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!keyData) return;
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_settings", { _key: keyData.key });
      if (!mounted) return;
      if (!error && data) {
        setSettings({ ...DEFAULTS, ...(data as PanelSettings) });
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [keyData]);

  const update = useCallback(
    async (patch: Partial<PanelSettings>) => {
      if (!keyData) return;
      const next = { ...settings, ...patch };
      setSettings(next);
      setSaving(true);
      await supabase.rpc("save_settings", {
        _key: keyData.key,
        _settings: next as never,
      });
      setSaving(false);
    },
    [keyData, settings]
  );

  return { settings, update, loading, saving };
}
