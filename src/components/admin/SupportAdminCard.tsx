import { useCallback, useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";

type Thread = { id: string; key_id: string; key: string; updated_at: string };
type Msg = { id: string; sender_type: "user" | "admin"; body: string; created_at: string };

const QUICK_ADMIN = [
  ["👋 Olá", "Olá! Como posso ajudar?"],
  ["💳 Pix", "Pode enviar o comprovante."],
  ["🔑 Key", "Pode informar sua key."],
  ["⏳ Aguarde", "Vou verificar para você."],
  ["📩 Detalhes", "Pode explicar melhor?"],
  ["🛠️ Configuração", "Vou ajudar na configuração."],
  ["✅ Resolvido", "Pronto! Resolvido."],
] as const;

export function SupportAdminCard() {
  const { password } = useAdmin();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    if (!password) return;
    const { data, error } = await supabase.rpc("admin_support_list_threads", { _password: password });
    if (!error) setThreads((data ?? []) as Thread[]);
    setLoading(false);
  }, [password]);

  const loadMessages = useCallback(async () => {
    if (!password || !selected) return;
    const { data } = await supabase.rpc("admin_support_list_messages", { _password: password, _thread_id: selected.id });
    setMessages((data ?? []) as Msg[]);
  }, [password, selected?.id]);

  useEffect(() => { loadThreads(); const t = window.setInterval(loadThreads, 2500); return () => window.clearInterval(t); }, [loadThreads]);
  useEffect(() => { loadMessages(); const t = window.setInterval(loadMessages, 2000); return () => window.clearInterval(t); }, [loadMessages]);

  const sendQuick = async (message: string) => {
    if (!password || !selected) return;
    const { error } = await supabase.rpc("admin_support_send_message", {
      _password: password,
      _thread_id: selected.id,
      _body: message,
    });
    if (error) { toast.error("Não foi possível enviar."); return; }
    loadMessages();
    loadThreads();
  };

  const send = async () => {
    if (!password || !selected || !body.trim()) return;
    const { error } = await supabase.rpc("admin_support_send_message", { _password: password, _thread_id: selected.id, _body: body.trim() });
    if (error) { toast.error("Não foi possível enviar."); return; }
    setBody("");
    loadMessages();
    loadThreads();
  };

  return (
    <section className="glass-strong rounded-3xl p-6 space-y-5">
      <header><p className="vip-eyebrow">Atendimento</p><h2 className="vip-title text-base">Chat de suporte</h2></header>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> :
        <div className="grid lg:grid-cols-[220px_1fr] gap-4">
          <div className="space-y-2">
            {threads.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma conversa.</p> :
              threads.map((t) => <button key={t.id} onClick={() => setSelected(t)} className={`w-full text-left rounded-2xl p-3 text-xs ${selected?.id === t.id ? "bg-white text-black" : "glass"}`}>{t.key}</button>)}
          </div>
          <div className="space-y-3">
            <div className="h-72 overflow-y-auto rounded-2xl bg-black/15 border border-white/10 p-3 space-y-2">
              {!selected ? <p className="text-xs text-muted-foreground text-center py-10">Selecione uma conversa.</p> :
                messages.map((m) => <div key={m.id} className={`flex ${m.sender_type === "admin" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.sender_type === "admin" ? "bg-white text-black" : "glass"}`}>{m.body}</div></div>)}
            </div>
            {selected && <>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {QUICK_ADMIN.map(([label, message]) => (
                  <Button key={label} variant="outline" onClick={() => sendQuick(message)} className="shrink-0 rounded-lg border-white/10 bg-white/5 text-[10px] h-7 px-2">
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2"><Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Responder…" rows={2} className="rounded-2xl bg-white/5 border-white/10 resize-none" /><Button onClick={send} disabled={!body.trim()} className="w-12 shrink-0 rounded-2xl bg-white text-black"><Send className="w-4 h-4" /></Button></div></>}
          </div>
        </div>}
    </section>
  );
}
