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
  const [noticeTitle, setNoticeTitle] = useState("🔔 Atualização programada");
  const [noticeBody, setNoticeBody] = useState("O Atlas VIP será atualizado em breve. Salve seu progresso e aguarde a liberação da nova versão.");
  const [sendingNotice, setSendingNotice] = useState(false);
  const [version, setVersion] = useState("1.0");
  const [versionSaving, setVersionSaving] = useState(false);

  const NOTICE_PRESETS: Record<string, { title: string; body: string }> = {
    before_update: { title: "🔔 Atualização programada", body: "O Atlas VIP será atualizado em breve. Salve seu progresso e aguarde a liberação da nova versão." },
    updated: { title: "🚀 Atualização concluída", body: "A atualização do Atlas VIP foi concluída com sucesso. Feche e abra o app para carregar a nova versão." },
    maintenance: { title: "🛠️ Manutenção iniciada", body: "O Atlas VIP entrou em manutenção para receber melhorias. O acesso será liberado assim que o serviço estiver pronto." },
    maintenance_end: { title: "✅ Manutenção concluída", body: "A manutenção foi finalizada. O Atlas VIP está disponível novamente e você já pode acessar normalmente." },
    bug: { title: "⚠️ Instabilidade identificada", body: "Identificamos uma instabilidade no Atlas VIP. Nossa equipe já está trabalhando para normalizar o serviço." },
    bug_fixed: { title: "🔧 Problema corrigido", body: "A instabilidade identificada foi corrigida. Feche e abra o app novamente para garantir que tudo esteja atualizado." },
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
      const [{ data }, { data: versionData }] = await Promise.all([
        supabase.rpc("get_maintenance"),
        supabase.rpc("get_app_version"),
      ]);
      if (!mounted) return;
      const obj = (data ?? {}) as { enabled?: boolean; message?: string };
      setEnabled(!!obj.enabled);
      setMessage(obj.message ?? "");
      if (versionData) setVersion(String(versionData));
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const saveVersion = async () => {
    if (!password || versionSaving) return;
    const normalized = version.trim().replace(",", ".");
    if (!/^\d+\.\d+$/.test(normalized)) {
      toast.error("Versão inválida", { description: "Use o formato X.Y, por exemplo 1.2 ou 2.0." });
      return;
    }
    setVersionSaving(true);
    const { data, error } = await supabase.rpc("admin_set_app_version", { _version: normalized, _password: password });
    setVersionSaving(false);
    if (error) toast.error("Não foi possível salvar a versão", { description: error.message });
    else { setVersion(String(data ?? normalized)); toast.success(`Versão ${data ?? normalized} salva.`); }
  };

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

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <p className="vip-eyebrow mb-1">Versão do aplicativo</p>
          <p className="text-xs text-muted-foreground">Defina manualmente a versão que aparece no topo do painel.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value.replace(",", "."))}
            placeholder="Ex.: 1.2"
            inputMode="decimal"
            className="h-10 flex-1 rounded-xl border border-white/10 bg-background px-3 text-sm outline-none focus:border-primary/50"
          />
          <Button onClick={saveVersion} disabled={loading || versionSaving} variant="outline" className="rounded-xl px-5">
            {versionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar versão"}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">A manutenção continua podendo avançar automaticamente 1.0 → 1.1 → … → 1.9 → 2.0.</p>
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
          <p className="vip-eyebrow mb-1">📢 Avisos de manutenção</p>
          <p className="text-xs text-muted-foreground">Selecione um modelo, personalize o texto e envie o aviso para todos os usuários.</p>
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
          <option value="before_update">🔔 Atualização programada</option>
          <option value="updated">🚀 Atualização concluída</option>
          <option value="maintenance">🛠️ Manutenção iniciada</option>
          <option value="maintenance_end">✅ Manutenção concluída</option>
          <option value="bug">⚠️ Instabilidade identificada</option>
          <option value="bug_fixed">🔧 Problema corrigido</option>
        </select>
        <input
          value={noticeTitle}
          onChange={(e) => setNoticeTitle(e.target.value)}
          maxLength={80}
          placeholder="Título do aviso (ex.: 🔔 Atualização programada)"
          className="h-10 w-full rounded-xl border border-white/10 bg-background px-3 text-sm outline-none focus:border-primary/50"
        />
        <Textarea
          value={noticeBody}
          onChange={(e) => setNoticeBody(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="Escreva a mensagem que os usuários receberão..."
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
