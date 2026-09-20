import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Loader2, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useKey } from "@/lib/key-context";

type Msg = { id: string; sender_type: "user" | "admin"; body: string; created_at: string; edited_at?: string | null };

const RECEIPT_PREFIX = "[[receipt]]";
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

export function SupportChat() {
  const { keyData } = useKey();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const sendMessage = async (message: string) => {
    if (!keyData?.key || !message.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.rpc("support_send_message", {
      _key: keyData.key,
      _body: message.trim(),
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar a mensagem.");
      return;
    }
    setBody("");
    load();
  };

  const sendReceipt = async (file: File) => {
    if (!keyData?.key || uploading) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem do comprovante.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 8 MB.");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeKey = keyData.key.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    const path = `${safeKey}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("support-receipts")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });

    if (uploadError) {
      setUploading(false);
      toast.error("Não foi possível enviar o comprovante.");
      return;
    }

    const { data } = supabase.storage.from("support-receipts").getPublicUrl(path);
    const { error } = await supabase.rpc("support_send_message", {
      _key: keyData.key,
      _body: `${RECEIPT_PREFIX}${data.publicUrl}`,
    });
    setUploading(false);

    if (error) {
      toast.error("Imagem enviada, mas não foi possível anexar ao chat.");
      return;
    }
    toast.success("Comprovante enviado.");
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
          messages.length === 0 ? <p className="text-xs text-muted-foreground text-center py-10">Nenhuma mensagem ainda. Envie sua dúvida abaixo.</p> :
          messages.map((m) => {
            const isReceipt = m.body.startsWith(RECEIPT_PREFIX);
            const receiptUrl = isReceipt ? m.body.slice(RECEIPT_PREFIX.length) : "";
            return (
              <div key={m.id} className={`flex ${m.sender_type === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.sender_type === "user" ? "bg-white text-black" : "glass"}`}>
                  {isReceipt ? (
                    <a href={receiptUrl} target="_blank" rel="noreferrer" className="block">
                      <img src={receiptUrl} alt="Comprovante" className="max-h-56 w-auto rounded-xl object-contain" />
                      <span className="mt-1 block text-[10px] opacity-60">Comprovante enviado</span>
                    </a>
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
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-2xl border-white/10 bg-white/5"
      >
        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
        {uploading ? "Enviando comprovante..." : "Enviar comprovante"}
      </Button>

      <div className="flex gap-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Digite sua mensagem…" rows={2} maxLength={1000} className="rounded-2xl bg-white/5 border-white/10 resize-none" />
        <Button onClick={() => sendMessage(body)} disabled={sending || !body.trim()} className="w-12 shrink-0 rounded-2xl bg-white text-black">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {QUICK_OPTIONS.map(([label, message]) => (
          <Button key={label} variant="outline" disabled={sending} onClick={() => sendMessage(message)} className="shrink-0 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 text-[10px] h-7 px-2">
            {label}
          </Button>
        ))}
      </div>
    </section>
  );
}
