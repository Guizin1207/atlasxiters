import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Send, Pencil, Check, X, CheckCircle2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import type { KeyData } from "@/lib/key-context";
import { ReceiptImage } from "@/components/atlas/ReceiptImage";
import { isReceiptBody, receiptRef } from "@/lib/receipts";
import { notifyUsers } from "@/lib/push";

type Thread = { id: string; key_id: string; key: string; updated_at: string };
type Msg = { id: string; sender_type: "user" | "admin"; body: string; created_at: string; edited_at?: string | null };

const QUICK_ADMIN = [
  ["👋 Olá! Como posso ajudar?", "👋 Olá! Como posso ajudar?"],
  ["💳 Pode enviar o comprovante.", "💳 Pode enviar o comprovante."],
  ["🔑 Pode informar sua key.", "🔑 Pode informar sua key."],
  ["⏳ Vou verificar para você.", "⏳ Vou verificar para você."],
  ["📩 Pode explicar melhor?", "📩 Pode explicar melhor?"],
  ["🛠️ Vou ajudar na configuração.", "🛠️ Vou ajudar na configuração."],
  ["✅ Pronto! Resolvido.", "✅ Pronto! Resolvido."],
] as const;

export function SupportAdminCard() {
  const { password } = useAdmin();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [closed, setClosed] = useState(false);
  const [keys, setKeys] = useState<KeyData[]>([]);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [keySearch, setKeySearch] = useState("");
  const [targetKeyId, setTargetKeyId] = useState("");
  const [initialBody, setInitialBody] = useState("");
  const [startingChat, setStartingChat] = useState(false);
  const [requestedThreadId, setRequestedThreadId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("thread")
  );

  const loadThreads = useCallback(async () => {
    if (!password) return;
    const { data, error } = await supabase.rpc("admin_support_list_threads", { _password: password });
    if (!error) {
      const list = (data ?? []) as Thread[];
      setThreads(list);
      if (requestedThreadId) {
        const match = list.find((item) => item.id === requestedThreadId);
        if (match) {
          setSelected(match);
          setRequestedThreadId(null);
        }
      }
    }
    setLoading(false);
  }, [password, requestedThreadId]);

  useEffect(() => {
    const onOpenThread = (event: Event) => {
      const id = (event as CustomEvent<{ threadId?: string }>).detail?.threadId;
      if (!id) return;
      const match = threads.find((item) => item.id === id);
      if (match) setSelected(match);
      else setRequestedThreadId(id);
    };
    window.addEventListener("atlas:open-support-thread", onOpenThread);
    return () => window.removeEventListener("atlas:open-support-thread", onOpenThread);
  }, [threads]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const threadId = selected?.id ?? requestedThreadId;
    url.searchParams.set("tab", "support");
    if (threadId) url.searchParams.set("thread", threadId);
    else url.searchParams.delete("thread");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [selected?.id, requestedThreadId]);

  const loadMessages = useCallback(async () => {
    if (!password || !selected) return;
    const { data } = await supabase.rpc("admin_support_list_messages", { _password: password, _thread_id: selected.id });
    setMessages((data ?? []) as Msg[]);
  }, [password, selected?.id]);

  useEffect(() => { loadThreads(); const t = window.setInterval(loadThreads, 2500); return () => window.clearInterval(t); }, [loadThreads]);
  useEffect(() => { loadMessages(); const t = window.setInterval(loadMessages, 2000); return () => window.clearInterval(t); }, [loadMessages]);

  useEffect(() => {
    if (!password) return;
    void supabase.rpc("admin_list_keys", { _password: password }).then(({ data, error }) => {
      if (!error && Array.isArray(data)) {
        setKeys(data as unknown as KeyData[]);
      }
    });
  }, [password]);

  const filteredKeys = useMemo(() => {
    const q = keySearch.trim().toLowerCase();
    return [...keys]
      .filter((k) => !k.revoked)
      .filter((k) => !q || k.key.toLowerCase().includes(q) || (k.note ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [keys, keySearch]);

  const startChatWithUser = async () => {
    if (!password || !targetKeyId || startingChat) return;
    setStartingChat(true);
    const msgText = initialBody.trim();
    const { data, error } = await supabase.rpc("admin_support_start_chat", {
      _password: password,
      _key_id: targetKeyId,
      _body: msgText || undefined,
    });
    setStartingChat(false);
    if (error || !data) {
      toast.error("Não foi possível iniciar a conversa com este usuário.");
      return;
    }
    const created = data as unknown as Thread & { message_id?: string | null };
    const thread: Thread = {
      id: created.id,
      key_id: created.key_id,
      key: created.key,
      updated_at: created.updated_at,
    };
    setClosed(false);
    setSelected(thread);
    setNewChatOpen(false);
    setInitialBody("");
    setTargetKeyId("");
    if (msgText) {
      alertUser(thread, msgText, created.message_id ?? undefined);
      toast.success(`Mensagem enviada para ${thread.key}.`);
    } else {
      toast.success(`Conversa aberta com ${thread.key}.`);
    }
    void loadThreads();
    void loadMessages();
  };

  const alertUser = (thread: Thread, text: string, messageId?: string) => {
    if (!password) return;
    void notifyUsers(password, "reply", {
      targetKey: thread.key,
      messageId,
      threadId: thread.id,
    }).then((result) => {
      if (!result.ok) toast.warning(`Resposta salva no chat. ${result.message}`);
    });
    void supabase.rpc("admin_send_message", {
      _password: password,
      _title: "Nova mensagem do suporte",
      _body: isReceiptBody(text)
        ? "O suporte respondeu no seu chat."
        : text.length > 160 ? text.slice(0, 160) + "…" : text,
      _target_key_id: thread.key_id,
    });
  };

  const sendQuick = async (message: string) => {
    if (!password || !selected) return;
    const { data, error } = await supabase.rpc("admin_support_send_message", {
      _password: password,
      _thread_id: selected.id,
      _body: message,
    });
    if (error) { toast.error("Não foi possível enviar."); return; }
    alertUser(selected, message, (data as { id?: string } | null)?.id);
    loadMessages();
    loadThreads();
  };

  const editMessage = async (id: string) => {
    if (!password || !editBody.trim()) return;
    const { error } = await supabase.rpc("admin_support_edit_message", { _password: password, _message_id: id, _body: editBody.trim() });
    if (error) { toast.error("Não foi possível editar."); return; }
    setEditingId(null); setEditBody(""); loadMessages(); loadThreads();
  };

  const finishChat = async () => {
    if (!password || !selected) return;
    const { error } = await supabase.rpc("admin_support_delete_chat", { _password: password, _thread_id: selected.id });
    if (error) { toast.error("Não foi possível finalizar o chat."); return; }
    setClosed(true); setSelected(null); setMessages([]); toast.success("Chat excluído."); loadThreads();
  };

  const send = async () => {
    if (!password || !selected || !body.trim()) return;
    const { data, error } = await supabase.rpc("admin_support_send_message", { _password: password, _thread_id: selected.id, _body: body.trim() });
    if (error) { toast.error("Não foi possível enviar."); return; }
    alertUser(selected, body.trim(), (data as { id?: string } | null)?.id);
    setBody("");
    loadMessages();
    loadThreads();
  };

  return (
    <section className="glass-strong rounded-3xl p-6 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="vip-eyebrow">Atendimento</p>
          <h2 className="vip-title text-base">Chat de suporte</h2>
        </div>
        <Button
          type="button"
          variant={newChatOpen ? "secondary" : "outline"}
          size="sm"
          onClick={() => setNewChatOpen((prev) => !prev)}
          className="rounded-xl border-white/10 bg-white/5 text-xs"
        >
          <UserPlus className="w-3.5 h-3.5 mr-1.5" />
          {newChatOpen ? "Fechar envio" : "Mandar mensagem para usuário"}
        </Button>
      </header>

      {newChatOpen && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <p className="vip-eyebrow">Iniciar conversa direta</p>
          <Input
            value={keySearch}
            onChange={(e) => setKeySearch(e.target.value)}
            placeholder="Buscar usuário pela key ou observação…"
            className="h-10 rounded-xl bg-white/5 border-white/10 text-xs"
          />
          <Select value={targetKeyId} onValueChange={setTargetKeyId}>
            <SelectTrigger className="h-11 rounded-xl bg-white/5 border-white/10 text-xs">
              <SelectValue placeholder="Selecione a key do usuário" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {filteredKeys.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.key}
                  {k.note ? ` — ${k.note}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={initialBody}
            onChange={(e) => setInitialBody(e.target.value)}
            placeholder="Digite a mensagem inicial para o usuário (opcional)…"
            rows={2}
            maxLength={1000}
            className="rounded-xl bg-white/5 border-white/10 resize-none text-sm"
          />
          <Button
            type="button"
            onClick={() => void startChatWithUser()}
            disabled={!targetKeyId || startingChat}
            className="w-full h-10 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-bold uppercase tracking-[0.12em]"
          >
            {startingChat ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-2" />}
            {initialBody.trim() ? "Enviar mensagem e abrir chat" : "Abrir conversa com usuário"}
          </Button>
        </div>
      )}

      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> :
        <div className="grid min-w-0 lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
          <div className="space-y-2">
            {threads.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma conversa.</p> :
              threads.map((t) => <button key={t.id} onClick={() => { setClosed(false); setSelected(t); }} className={`w-full text-left rounded-2xl p-3 text-xs ${selected?.id === t.id ? "bg-white text-black" : "glass"}`}>{t.key}</button>)}
          </div>
          <div className="min-w-0 space-y-3">
            <div className="h-72 min-w-0 overflow-y-auto rounded-2xl bg-black/15 border border-white/10 p-3 space-y-2">
              {!selected ? <p className="text-xs text-muted-foreground text-center py-10">Selecione uma conversa.</p> :
                messages.map((m) => <div key={m.id} className={`flex min-w-0 ${m.sender_type === "admin" ? "justify-end" : "justify-start"}`}><div className={`w-fit max-w-[85%] min-w-0 rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-all overflow-hidden ${m.sender_type === "admin" ? "bg-white text-black" : "glass"}`}>{isReceiptBody(m.body) ? <ReceiptImage refValue={receiptRef(m.body)} caption="Abrir comprovante" auth={{ password }} /> : editingId === m.id ? <div className="space-y-2"><Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} maxLength={1000} className="bg-black/10 border-black/10 text-inherit resize-none" /><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => { setEditingId(null); setEditBody(""); }}><X className="w-3 h-3" /></Button><Button size="icon" variant="ghost" onClick={() => editMessage(m.id)}><Check className="w-3 h-3" /></Button></div></div> : <>{m.body}{m.edited_at && <span className="ml-1 text-[9px] opacity-60">(editada)</span>}{m.sender_type === "admin" && <button className="ml-2 opacity-60 hover:opacity-100" onClick={() => { setEditingId(m.id); setEditBody(m.body); }}><Pencil className="inline w-3 h-3" /></button>}</>}</div></div>)}
            </div>
            {selected && <>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {QUICK_ADMIN.map(([label, message]) => (
                  <Button key={label} variant="outline" onClick={() => sendQuick(message)} className="shrink-0 rounded-lg border-white/10 bg-white/5 text-[10px] h-7 px-2">
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2"><Button variant="outline" onClick={finishChat} disabled={closed} className="h-7 rounded-lg text-[10px] px-2"><CheckCircle2 className="w-3 h-3 mr-1" /> Finalizar chat</Button></div>
              <div className="flex gap-2"><Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Responder…" rows={2} className="rounded-2xl bg-white/5 border-white/10 resize-none" /><Button onClick={send} disabled={!body.trim() || closed} className="w-12 shrink-0 rounded-2xl bg-white text-black"><Send className="w-4 h-4" /></Button></div></>}
          </div>
        </div>}
    </section>
  );
}
