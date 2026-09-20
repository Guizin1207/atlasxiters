import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Loader2, ImagePlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useKey } from "@/lib/key-context";
import { ReceiptImage } from "@/components/atlas/ReceiptImage";
import { RECEIPT_BUCKET, RECEIPT_EXTENSIONS, RECEIPT_MAX_BYTES, RECEIPT_PREFIX, isReceiptBody, receiptRef } from "@/lib/receipts";
import { notifyAdmin } from "@/lib/push";

type Msg = { id: string; sender_type: "user" | "admin"; body: string; created_at: string; edited_at?: string | null };
const QUICK_OPTIONS = [
  ["🔑 Não recebi minha key.", "🔑 Não recebi minha key."],
  ["💰 Enviei o Pix.", "💰 Enviei o Pix."],
  ["⏳ Quero saber sobre a aprovação.", "⏳ Quero saber sobre a aprovação."],
  ["🎮 Estou com problema no Free Fire.", "🎮 Estou com problema no Free Fire."],
  ["⚙️ Preciso de ajuda na configuração.", "⚙️ Preciso de ajuda na configuração."],
  ["🔄 Estou com problema na minha key.", "🔄 Estou com problema na minha key."],
  ["🛒 Quero comprar um plano.", "🛒 Quero comprar um plano."],
  ["👨‍💻 Quero falar com o ADM.", "👨‍💻 Quero falar com o ADM."],
] as const;

export function SupportChat({ accessKey }: { accessKey?: string | null }) {
  const { keyData } = useKey();
  const supportKey = (accessKey || keyData?.key || "").trim().toUpperCase();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!supportKey) {
      setMessages([]);
      setLoadError(false);
      setLoading(false);
      return;
    }

    let timeoutId: number | undefined;
    try {
      const request = supabase.rpc("support_list_messages", { _key: supportKey });
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("support_history_timeout")), 12_000);
      });
      const { data, error } = await Promise.race([request, timeout]);
      if (error) throw error;
      setMessages((data ?? []) as Msg[]);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [supportKey]);

  useEffect(() => {
    setLoading(true);
    void load();
    if (!supportKey) return;
    const timer = window.setInterval(load, 2500);
    return () => window.clearInterval(timer);
  }, [load, supportKey]);

  const sendMessage = async (message: string) => {
    if (!supportKey || !message.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.rpc("support_send_message", {
      _key: supportKey,
      _body: message.trim(),
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar a mensagem.");
      return;
    }
    setBody("");
    void notifyAdmin("message", supportKey);
    void load();
  };

  const sendReceipt = async (file: File) => {
    if (!supportKey || uploading) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem do comprovante.");
      return;
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      toast.error("A imagem deve ter no máximo 8 MB.");
      return;
    }

    setUploading(true);
    let ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!(RECEIPT_EXTENSIONS as readonly string[]).includes(ext)) {
      ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    }
    const safeKey = supportKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    const path = `${safeKey}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });

    if (uploadError) {
      setUploading(false);
      toast.error("Não foi possível enviar o comprovante.");
      return;
    }

    const { error } = await supabase.rpc("support_send_message", {
      _key: supportKey,
      _body: `${RECEIPT_PREFIX}${path}`,
    });
    setUploading(false);

    if (error) {
      toast.error("Imagem enviada, mas não foi possível anexar ao chat.");
      return;
    }
    toast.success("Comprovante enviado.");
    void notifyAdmin("receipt", supportKey);
    void load();
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
          !supportKey ? <p className="text-xs text-muted-foreground text-center py-10">Informe sua key no campo de acesso para abrir o atendimento.</p> :
          loadError ? (
            <div className="flex flex-col items-center gap-3 py-9 text-center">
              <p className="text-xs text-status-danger">Não foi possível carregar o histórico.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => { setLoading(true); void load(); }} className="rounded-xl border-white/10 bg-white/5">
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Tentar novamente
              </Button>
            </div>
          ) :
          messages.length === 0 ? <p className="text-xs text-muted-foreground text-center py-10">Nenhuma mensagem ainda. Envie sua dúvida abaixo.</p> :
          messages.map((m) => {
            const isReceipt = isReceiptBody(m.body);
            return (
              <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.sender_type === "user" ? "bg-white text-black" : "glass"}`}>
                  {isReceipt ? (
                    <ReceiptImage refValue={receiptRef(m.body)} caption="Comprovante enviado" />
                  ) : m.body}
                </div>
              </div>
            );
          })}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void sendReceipt(file);
          e.currentTarget.value = "";
        }}
      />

      <Button
        type="button"
        variant="outline"
        disabled={uploading || !supportKey}
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-2xl border-white/10 bg-white/5"
      >
        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
        {uploading ? "Enviando comprovante..." : "Enviar comprovante"}
      </Button>

      <div className="flex gap-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Digite sua mensagem…" rows={2} maxLength={1000} className="rounded-2xl bg-white/5 border-white/10 resize-none" />
        <Button onClick={() => sendMessage(body)} disabled={sending || !supportKey || !body.trim()} className="w-12 shrink-0 rounded-2xl bg-white text-black">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {QUICK_OPTIONS.map(([label, message]) => (
          <Button key={label} variant="outline" disabled={sending || !supportKey} onClick={() => sendMessage(message)} className="shrink-0 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 text-[10px] h-7 px-2">
            {label}
          </Button>
        ))}
      </div>
    </section>
  );
}
