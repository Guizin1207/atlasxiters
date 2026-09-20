import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useKey } from "@/lib/key-context";

type Msg = { id: string; sender_type: "user" | "admin"; body: string; created_at: string };

export function SupportChat() {
  const { keyData } = useKey();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!keyData?.key) return;
    const { data, error } = await supabase.rpc("support_list_messages", { _key: keyData.key });
    if (!error) setMessages((data ?? []) as Msg[]);
    setLoading(false);
  }, [keyData?.key]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 2500);
    return () => window.clearInterval(timer);
  }, [load]);

  const send = async () => {
    if (!keyData?.key || !body.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.rpc("support_send_message", {
      _key: keyData.key,
      _body: body.trim(),
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar a mensagem.");
      return;
    }
    setBody("");
    load();
  };

  return (
    <section className="glass-strong rounded-3xl p-5 space-y-4">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center">
          <MessageCircle className="w-4 h-4" />
        </div>
        <div>
          <p className="vip-eyebrow">Suporte</p>
          <h2 className="font-bold">Falar com o ADM</h2>
        </div>
      </header>
      <div className="h-80 overflow-y-auto rounded-2xl bg-black/15 border border-white/10 p-3 space-y-2">
        {loading ? <div className="flex justify-center py-10"><Loader2 className="w-4 h-4 animate-spin" /></div> :
          messages.length === 0 ? <p className="text-xs text-muted-foreground text-center py-10">Nenhuma mensagem ainda. Envie sua dúvida.</p> :
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.sender_type === "user" ? "bg-white text-black" : "glass"}`}>
                {m.body}
              </div>
            </div>
          ))}
      </div>
      <div className="flex gap-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Digite sua mensagem…" rows={2} maxLength={1000} className="rounded-2xl bg-white/5 border-white/10 resize-none" />
        <Button onClick={send} disabled={sending || !body.trim()} className="w-12 shrink-0 rounded-2xl bg-white text-black">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </section>
  );
}
