/**
 * Mensagens do usuário — carrega lista, contador de não-lidas,
 * Realtime para novas mensagens (com toast) e marcar como lidas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useKey } from "@/lib/key-context";
import { withTimeout } from "@/lib/request-timeout";

export type UserMessage = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  is_direct: boolean;
  is_read: boolean;
};

export function useMessages() {
  const { keyData, expiredKey } = useKey();
  const key = keyData?.key ?? expiredKey ?? null;
  const keyId = keyData?.id ?? null;

  const [result, setResult] = useState<{ key: string | null; messages: UserMessage[] }>({ key: null, messages: [] });
  const messages = useMemo(() => result.key === key ? result.messages : [], [result, key]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const activeKey = useRef(key);
  activeKey.current = key;
  const requestVersion = useRef(0);
  const invalidateRequests = useCallback(() => { requestVersion.current++; }, []);
  const knownIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!key) { setLoading(false); return; }
    try {
      const { data, error } = await withTimeout(supabase.rpc("list_my_messages", { _key: key }));
      if (activeKey.current !== key || version !== requestVersion.current) return;
      if (error) throw error;
      const list = (data ?? []) as UserMessage[];
      setResult({ key, messages: list });
      setLoadError(false);

      if (initialized.current) {
        // Detecta novas mensagens
        list.forEach((m) => {
          if (!knownIds.current.has(m.id) && !m.is_read) {
            const showToast = m.title.toLowerCase().includes("expirad") ? toast.error : toast;
            showToast(m.title, {
              description:
                m.body.length > 120 ? m.body.slice(0, 120) + "…" : m.body,
            });
          }
        });
      }
      knownIds.current = new Set(list.map((m) => m.id));
      initialized.current = true;
    } catch {
      if (activeKey.current === key && version === requestVersion.current) setLoadError(true);
    } finally {
      if (activeKey.current === key && version === requestVersion.current) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    setResult({ key, messages: [] });
    initialized.current = false;
    knownIds.current = new Set();
    void load();
    const recheck = () => { if (document.visibilityState !== "hidden") void load(); };
    const timer = key ? window.setInterval(recheck, 15_000) : undefined;
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      invalidateRequests();
      window.clearInterval(timer);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [key, load, invalidateRequests]);

  // Realtime: nova mensagem (broadcast ou para esta chave) recarrega
  useEffect(() => {
    if (!key) return;
    const ch = supabase
      .channel(`user-messages-${keyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_messages" },
        (payload) => {
          const row = payload.new as { target_key_id: string | null };
          if (row.target_key_id === null || row.target_key_id === keyId) {
            load();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "admin_messages" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [key, keyId, load]);

  const unread = useMemo(
    () => messages.filter((m) => !m.is_read).length,
    [messages]
  );

  const markAllRead = useCallback(async () => {
    if (!key) return;
    const ids = messages.filter((m) => !m.is_read).map((m) => m.id);
    if (ids.length === 0) return;
    try {
      const { error } = await withTimeout(supabase.rpc("mark_messages_read", { _key: key, _ids: ids }));
      if (error || activeKey.current !== key) return;
      setResult((prev) => prev.key === key
        ? { key, messages: prev.messages.map((m) => ids.includes(m.id) ? { ...m, is_read: true } : m) }
        : prev);
    } catch { /* Mantém as mensagens não lidas se o servidor não confirmou. */ }
  }, [key, messages]);

  return { messages, unread, loading, loadError, markAllRead, reload: load };
}
