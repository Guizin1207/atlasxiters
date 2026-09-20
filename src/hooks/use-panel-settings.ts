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

const localKey = (key: string) => `atlas_settings_${key}`;

function readLocal(key: string): PanelSettings {
  try {
    return JSON.parse(localStorage.getItem(localKey(key)) ?? "{}") as PanelSettings;
  } catch {
    return {};
  }
}

export function usePanelSettings() {
  const { keyData } = useKey();
  const [settings, setSettings] = useState<PanelSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!keyData) return;
    let mounted = true;
    (async () => {
      const local = readLocal(keyData.key);
      setSettings({ ...DEFAULTS, ...local });
      const { data, error } = await supabase.rpc("get_settings", { _key: keyData.key });
      if (!mounted) return;
      if (!error && data) {
        // O espelho local vence para manter alterações instantâneas entre abas.
        setSettings({ ...DEFAULTS, ...(data as PanelSettings), ...local });
      }
      setLoading(false);
    })();
    const clearFunctionsOnExit = () => {
      const cleared = { ...readLocal(keyData.key), functions: {} };
      localStorage.setItem(localKey(keyData.key), JSON.stringify(cleared));
      void supabase.rpc("save_settings", {
        _key: keyData.key,
        _settings: cleared as never,
      });
    };

    window.addEventListener("pagehide", clearFunctionsOnExit);
    document.addEventListener("visibilitychange", clearFunctionsOnExit);

    return () => {
      mounted = false;
      window.removeEventListener("pagehide", clearFunctionsOnExit);
      document.removeEventListener("visibilitychange", clearFunctionsOnExit);
    };
  }, [keyData]);

  const update = useCallback(
    async (patch: Partial<PanelSettings>) => {
      if (!keyData) return;
      const next = { ...settings, ...patch };
      setSettings(next);
      localStorage.setItem(localKey(keyData.key), JSON.stringify(next));
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
