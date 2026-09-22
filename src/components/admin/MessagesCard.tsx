/**
 * MessagesCard — admin envia mensagens (broadcast ou para uma chave específica)
 * e visualiza histórico com contagem de leituras.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  MessageSquarePlus,
  Send,
  Trash2,
  Users,
  User,
  Eye,
  Pencil,
  Check,
  X,
} from "lucide-react";
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
import { notifyUsers } from "@/lib/push";

type AdminMessage = {
  id: string;
  title: string;
  body: string;
  target_key_id: string | null;
  target_key: string | null;
  created_at: string;
  read_count: number;
  edited_at?: string | null;
};

const BROADCAST = "__broadcast__";

export function MessagesCard() {
  const { password } = useAdmin();
  const [keys, setKeys] = useState<KeyData[]>([]);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<string>(BROADCAST);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const load = useCallback(async () => {
    if (!password) return;
    const [msgRes, keysRes] = await Promise.all([
      supabase.rpc("admin_list_messages", { _password: password }),
      supabase.rpc("admin_list_keys", { _password: password }),
    ]);
    if (!msgRes.error) setMessages((msgRes.data ?? []) as AdminMessage[]);
    if (!keysRes.error) setKeys((keysRes.data ?? []) as unknown as KeyData[]);
    setLoading(false);
  }, [password]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime — atualiza contagem/lista quando há leitura ou nova msg
  useEffect(() => {
    const ch = supabase
      .channel("admin-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_messages" },
        load
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reads" },
        load
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const send = useCallback(async () => {
    if (!password || busy) return;
    if (!title.trim() || !body.trim()) {
      toast.error("Preencha título e mensagem.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_send_message", {
      _password: password,
      _title: title.trim(),
      _body: body.trim(),
      _target_key_id: target === BROADCAST ? null : target,
    });
    setBusy(false);
    if (error) {
      toast.error("Falha ao enviar mensagem.");
      return;
    }
    void notifyUsers(password, "notice", {
      targetKey: target === BROADCAST ? undefined : keys.find((k) => k.id === target)?.key,
      body: title.trim(),
    });
    toast.success(
      target === BROADCAST
        ? "Mensagem enviada para todas as chaves."
        : "Mensagem enviada."
    );
    setTitle("");
    setBody("");
    setTarget(BROADCAST);
    load();
  }, [password, busy, title, body, target, keys, load]);

  const editMessage = useCallback(async (id: string) => {
    if (!password || !editTitle.trim() || !editBody.trim()) {
      toast.error("Preencha título e mensagem.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("admin_edit_message", {
      _password: password,
      _id: id,
      _title: editTitle.trim(),
      _body: editBody.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error("Falha ao editar mensagem.");
      return;
    }
    setEditingId(null);
    setEditTitle("");
    setEditBody("");
    toast.success("Mensagem editada.");
    load();
  }, [password, editTitle, editBody, load]);

  const remove = useCallback(
    async (id: string) => {
      if (!password) return;
      const { error } = await supabase.rpc("admin_delete_message", {
        _password: password,
        _id: id,
      });
      if (error) {
        toast.error("Falha ao apagar.");
        return;
      }
      toast.success("Mensagem apagada.");
      load();
    },
    [password, load]
  );

  const sortedKeys = useMemo(
    () => [...keys].sort((a, b) => a.key.localeCompare(b.key)),
    [keys]
  );

  return (
    <section className="glass-strong rounded-3xl p-6 space-y-6">
      <header className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl glass flex items-center justify-center">
          <MessageSquarePlus className="w-4 h-4" />
        </div>
        <div>
          <p className="vip-eyebrow">Comunicação</p>
          <h2 className="vip-title text-base leading-none">Mensagens</h2>
        </div>
      </header>

      {/* Composer */}
      <div className="space-y-3">
        <div>
          <label className="vip-eyebrow block mb-2">Destinatário</label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="h-12 rounded-2xl bg-white/5 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={BROADCAST}>
                <span className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  Broadcast — todas as chaves
                </span>
              </SelectItem>
              {sortedKeys.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  <span className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    {k.key}
                    {k.note ? (
                      <span className="text-muted-foreground">
                        — {k.note}
                      </span>
                    ) : null}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="vip-eyebrow block mb-2">Título</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Nova função disponível"
            maxLength={120}
            className="h-12 rounded-2xl bg-white/5 border-white/10"
          />
        </div>

        <div>
          <label className="vip-eyebrow block mb-2">Mensagem</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escreva o conteúdo…"
            rows={4}
            maxLength={1000}
            className="rounded-2xl bg-white/5 border-white/10 resize-none"
          />
        </div>

        <Button
          onClick={send}
          disabled={busy || !title.trim() || !body.trim()}
          className="w-full h-12 rounded-2xl bg-white text-black hover:bg-white/90 font-bold uppercase tracking-[0.15em] text-sm"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Enviar
            </>
          )}
        </Button>
      </div>

      {/* Histórico */}
      <div>
        <p className="vip-eyebrow mb-3">Histórico</p>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma mensagem enviada.
          </p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => (
              <li
                key={m.id}
                className="glass rounded-2xl p-4 space-y-2 animate-fade-in"
              >
                {editingId === m.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={120}
                      placeholder="Título"
                      className="h-10 rounded-xl bg-white/5 border-white/10"
                    />
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      maxLength={1000}
                      rows={4}
                      placeholder="Mensagem"
                      className="rounded-xl bg-white/5 border-white/10 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingId(null); setEditTitle(""); setEditBody(""); }} disabled={busy}>
                        <X className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => editMessage(m.id)} disabled={busy}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{m.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {m.body}
                        {m.edited_at && <span className="ml-1 opacity-60">(editada)</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditingId(m.id); setEditTitle(m.title); setEditBody(m.body); }}
                        aria-label="Editar mensagem"
                        className="w-8 h-8 rounded-xl"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(m.id)}
                        aria-label="Apagar mensagem"
                        className="w-8 h-8 rounded-xl hover:bg-status-danger/15 hover:text-status-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    {m.target_key ? (
                      <>
                        <User className="w-3 h-3" />
                        {m.target_key}
                      </>
                    ) : (
                      <>
                        <Users className="w-3 h-3" />
                        Broadcast
                      </>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3 h-3" />
                    {m.read_count} {m.read_count === 1 ? "leitura" : "leituras"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
