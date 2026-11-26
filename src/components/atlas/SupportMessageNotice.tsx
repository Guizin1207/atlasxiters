import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { isReceiptBody } from "@/lib/receipts";

type SupportReply = { id: string; thread_id: string; sender_type: string; body: string };

export function SupportMessageNotice({ accessKey, keyId, chatOpen, onOpen }: {
  accessKey: string;
  keyId: string;
  chatOpen: boolean;
  onOpen: (threadId: string) => void;
}) {
  const [reply, setReply] = useState<SupportReply | null>(null);
  const [visible, setVisible] = useState(document.visibilityState === "visible");
  const storageKey = `atlas_support_seen:${keyId}`;

  useEffect(() => {
    let cancelled = false;
    let pending = false;
    setReply(null);
    const check = async () => {
      const foreground = document.visibilityState === "visible";
      setVisible(foreground);
      if (!foreground || pending) return;
      pending = true;
      try {
        const { data, error } = await supabase.rpc("support_list_messages", { _key: accessKey });
        if (cancelled || error) return;
        const messages = (data ?? []) as SupportReply[];
        const latest = messages[messages.length - 1];
        const supportVisible = chatOpen || Boolean(document.querySelector("[data-support-chat]"));
        if (!latest || latest.sender_type !== "admin") {
          setReply(null);
          return;
        }
        if (supportVisible) {
          localStorage.setItem(storageKey, latest.id);
          setReply(null);
        } else {
          setReply(localStorage.getItem(storageKey) === latest.id ? null : latest);
        }
      } catch {
        // Preserve the last notice on temporary network failures; retry next tick.
      } finally {
        pending = false;
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 5000);
    const onVisibility = () => void check();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [accessKey, storageKey, chatOpen]);

  if (!reply || chatOpen || !visible || document.querySelector("[data-support-chat]")) return null;

  const dismiss = () => {
    localStorage.setItem(storageKey, reply.id);
    setReply(null);
  };

  return (
    <aside role="status" aria-label="Nova mensagem do suporte" className="fixed inset-x-3 top-3 z-[80] mx-auto max-w-md rounded-lg border border-primary/40 bg-popover p-4 text-popover-foreground shadow-lg animate-fade-in">
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-1 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Nova mensagem do suporte</p>
          <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">{isReceiptBody(reply.body) ? "O suporte enviou um anexo." : reply.body}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Dispensar aviso do suporte" onClick={dismiss}><X className="h-4 w-4" /></Button>
      </div>
      <Button className="mt-3 w-full gap-2" onClick={() => { const threadId = reply.thread_id; dismiss(); onOpen(threadId); }}>
        <MessageCircle className="h-4 w-4" />Ir para o chat de suporte
      </Button>
    </aside>
  );
}