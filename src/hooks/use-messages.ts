/**
 * Mensagens do usuário — carrega lista, contador de não-lidas,
 * Realtime para novas mensagens (com toast) e marcar como lidas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useKey } from "@/lib/key-context";

export type UserMessage = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  is_direct: boolean;
  is_read: boolean;
};

export function useMessages() {
  const { keyData } = useKey();
  const key = keyData?.key ?? null;
  const keyId = keyData?.id ?? null;

  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const knownIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const load = useCallback(async () => {
    if (!key) return;
    const { data, error } = await supabase.rpc("list_my_messages", {
      _key: key,
    });
    if (error) return;
    const list = (data ?? []) as UserMessage[];
    setMessages(list);

    if (initialized.current) {
      // Detecta novas mensagens
      list.forEach((m) => {
        if (!knownIds.current.has(m.id) && !m.is_read) {
          toast(m.title, {
            description:
              m.body.length > 120 ? m.body.slice(0, 120) + "…" : m.body,
          });
        }
      });
    }
    knownIds.current = new Set(list.map((m) => m.id));
    initialized.current = true;
    setLoading(false);
  }, [key]);

  useEffect(() => {
    setLoading(true);
    initialized.current = false;
    knownIds.current = new Set();
    load();
  }, [load]);

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
    await supabase.rpc("mark_messages_read", { _key: key, _ids: ids });
    setMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
  }, [key, messages]);

  return { messages, unread, loading, markAllRead, reload: load };
}
