/**
 * Sincroniza preferências do usuário (jsonb) por chave.
 */
import { useCallback, useEffect, useRef, useState } from "react";
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
const SETTINGS_EVENT = "atlas:panel-settings-changed";

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
  const settingsRef = useRef<PanelSettings>(DEFAULTS);
  settingsRef.current = settings;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!keyData) return;
    let mounted = true;
    (async () => {
      const local = readLocal(keyData.key);
      const initial = { ...DEFAULTS, ...local };
      settingsRef.current = initial;
      setSettings(initial);
      const { data, error } = await supabase.rpc("get_settings", { _key: keyData.key });
      if (!mounted) return;
      if (!error && data) {
        // O espelho local vence para manter alterações instantâneas entre abas.
        const merged = { ...DEFAULTS, ...(data as PanelSettings), ...readLocal(keyData.key) };
        settingsRef.current = merged;
        setSettings(merged);
      }
      setLoading(false);
    })();

    const onExternalUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; settings: PanelSettings }>).detail;
      if (!detail || detail.key !== keyData.key) return;
      settingsRef.current = detail.settings;
      setSettings(detail.settings);
    };

    const clearFunctionsOnExit = () => {
      const cleared = { ...readLocal(keyData.key), functions: {} };
      localStorage.setItem(localKey(keyData.key), JSON.stringify(cleared));
      settingsRef.current = cleared;
      setSettings(cleared);
      window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { key: keyData.key, settings: cleared } }));
      void supabase.rpc("save_settings", {
        _key: keyData.key,
        _settings: cleared as never,
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") clearFunctionsOnExit();
    };

    window.addEventListener(SETTINGS_EVENT, onExternalUpdate);
    window.addEventListener("pagehide", clearFunctionsOnExit);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      window.removeEventListener(SETTINGS_EVENT, onExternalUpdate);
      window.removeEventListener("pagehide", clearFunctionsOnExit);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [keyData]);



  const update = useCallback(
    async (patch: Partial<PanelSettings>) => {
      if (!keyData) return;
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      setSettings(next);
      localStorage.setItem(localKey(keyData.key), JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: { key: keyData.key, settings: next } }));
      setSaving(true);
      await supabase.rpc("save_settings", {
        _key: keyData.key,
        _settings: next as never,
      });
      setSaving(false);
    },
    [keyData]
  );

  return { settings, update, loading, saving };
}
