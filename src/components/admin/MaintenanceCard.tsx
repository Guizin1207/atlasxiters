import { useEffect, useState } from "react";
import { Wrench, Save, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import { notifyUsers } from "@/lib/push";

export function MaintenanceCard() {
  const { password } = useAdmin();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noticeType, setNoticeType] = useState("before_update");
  const [noticeTitle, setNoticeTitle] = useState("Atlas VIP — Atualização programada");
  const [noticeBody, setNoticeBody] = useState("O Atlas VIP será atualizado em breve. Salve seu progresso e aguarde o aviso de conclusão.");
  const [sendingNotice, setSendingNotice] = useState(false);

  const NOTICE_PRESETS: Record<string, { title: string; body: string }> = {
    before_update: { title: "Atlas VIP — Atualização programada", body: "O Atlas VIP será atualizado em breve. Salve seu progresso e aguarde o aviso de conclusão." },
    updated: { title: "Atlas VIP — Atualização concluída", body: "O Atlas VIP foi atualizado. Feche e abra o app novamente para carregar a versão mais nova." },
    maintenance: { title: "Atlas VIP — Manutenção", body: "O Atlas VIP está passando por manutenção. Tente novamente em alguns instantes." },
    maintenance_end: { title: "Atlas VIP — Manutenção concluída", body: "A manutenção foi concluída e o Atlas VIP já está disponível normalmente." },
    bug: { title: "Atlas VIP — Instabilidade", body: "Identificamos uma instabilidade no aplicativo. Nossa equipe já está verificando o problema." },
    bug_fixed: { title: "Atlas VIP — Problema corrigido", body: "O problema identificado foi corrigido. Feche e abra o app novamente para atualizar." },
  };

  const sendNotice = async () => {
    if (!password || sendingNotice) return;
    setSendingNotice(true);
    const title = noticeTitle.trim() || "Atlas VIP";
    const body = noticeBody.trim() || "Aviso do Atlas VIP.";
    const pushResult = await notifyUsers(password, "notice", { title, body });
    const { error } = await supabase.rpc("admin_send_message", {
      _password: password,
      _title: title,
      _body: body,
      _target_key_id: null,
    });
    setSendingNotice(false);
    if (error) toast.error("Não foi possível salvar o aviso no aplicativo.");
    else if (pushResult.ok) toast.success("Aviso enviado para os usuários.");
    else toast.warning(`Aviso salvo no aplicativo. ${pushResult.message}`);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.rpc("get_maintenance");
      if (!mounted) return;
      const obj = (data ?? {}) as { enabled?: boolean; message?: string };
      setEnabled(!!obj.enabled);
      setMessage(obj.message ?? "");
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    if (!password) return;
    setSaving(true);
    const { error } = await supabase.rpc("admin_set_maintenance", {
      _enabled: enabled,
      _message: message,
      _password: password,
    });
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar", { description: error.message });
    } else {
      void notifyUsers(password, enabled ? "maintenance" : "maintenance_end");
      toast.success(enabled ? "Manutenção ATIVADA" : "Manutenção desativada");
    }
  };

  return (
    <section className="glass-strong rounded-3xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="vip-eyebrow mb-1">Sistema</p>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Manutenção
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-[10px] uppercase tracking-[0.2em] font-bold ${
              enabled ? "text-status-warning" : "text-muted-foreground"
            }`}
          >
            {enabled ? "ON" : "OFF"}
          </span>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={loading}
          />
        </div>
      </div>

      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={loading}
        rows={4}
        placeholder="Mensagem exibida durante a manutenção…"
        className="rounded-2xl bg-white/5 border-white/10 resize-none focus-visible:ring-white/30"
      />

      <Button
        onClick={save}
        disabled={loading || saving}
        className="w-full h-12 rounded-2xl bg-white text-black hover:bg-white/90 font-bold uppercase tracking-[0.15em]"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Save className="w-4 h-4 mr-2" />
        )}
        Salvar
      </Button>

      <p className="text-[11px] text-muted-foreground">
        Quando ON, todos os usuários (exceto chave master) veem o modal de
        manutenção e ficam bloqueados.
      </p>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <p className="vip-eyebrow mb-1">Avisos de manutenção</p>
          <p className="text-xs text-muted-foreground">Escolha um aviso, edite o texto e envie para todos os usuários.</p>
        </div>
        <select
          value={noticeType}
          onChange={(e) => {
            const value = e.target.value;
            setNoticeType(value);
            const preset = NOTICE_PRESETS[value];
            if (preset) { setNoticeTitle(preset.title); setNoticeBody(preset.body); }
          }}
          className="h-10 w-full rounded-xl border border-white/10 bg-background px-3 text-sm outline-none"
        >
          <option value="before_update">Avisar que vai atualizar</option>
          <option value="updated">Avisar que atualizou</option>
          <option value="maintenance">Avisar que entrou em manutenção</option>
          <option value="maintenance_end">Avisar que saiu da manutenção</option>
          <option value="bug">Avisar sobre bug / instabilidade</option>
          <option value="bug_fixed">Avisar que o bug foi corrigido</option>
        </select>
        <input
          value={noticeTitle}
          onChange={(e) => setNoticeTitle(e.target.value)}
          maxLength={80}
          placeholder="Título do aviso"
          className="h-10 w-full rounded-xl border border-white/10 bg-background px-3 text-sm outline-none focus:border-primary/50"
        />
        <Textarea
          value={noticeBody}
          onChange={(e) => setNoticeBody(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Texto do aviso"
          className="rounded-xl bg-background border-white/10 resize-none"
        />
        <Button onClick={sendNotice} disabled={sendingNotice || saving} variant="outline" className="w-full rounded-2xl">
          {sendingNotice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Enviar aviso para todos
        </Button>
      </div>
    </section>
  );
}
