/** Cartão do admin para ativar notificações push neste aparelho. */
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Trash2, Smartphone, Info, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import { currentPushStatus, enableAdminPush, disableAdminPush, notifyUsers, type PushStatus } from "@/lib/push";

type Sub = { id: string; endpoint: string; device: string | null; created_at: string; scope?: string | null };

const STATUS_TEXT: Record<PushStatus, string> = {
  unsupported: "Este navegador não aceita notificações.",
  "ios-needs-install": "No iPhone, adicione o app à Tela de Início e abra por lá para ativar.",
  denied: "As notificações foram bloqueadas. Libere nas configurações do navegador.",
  ready: "Este aparelho ainda não recebe notificações.",
  enabled: "Este aparelho está recebendo notificações.",
};

export function PushNotificationsCard() {
  const { password } = useAdmin();
  const [status, setStatus] = useState<PushStatus>("ready");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!password) return;
    const [nextStatus, listed] = await Promise.all([
      currentPushStatus(),
      supabase.rpc("admin_list_push_subscriptions", { _password: password }),
    ]);
    setStatus(nextStatus);
    if (!listed.error) setSubs((listed.data ?? []) as Sub[]);
    setLoading(false);
  }, [password]);

  useEffect(() => {
    void load();
  }, [load]);

  const activate = async () => {
    if (!password || busy) return;
    setBusy(true);
    try {
      const next = await enableAdminPush(password);
      setStatus(next);
      if (next === "enabled") toast.success("Notificações ativadas neste aparelho.");
      else toast.error(STATUS_TEXT[next]);
    } catch (err) {
      toast.error("Não foi possível ativar as notificações.");
      console.error(err);
    }
    setBusy(false);
    void load();
  };

  const remove = async (sub: Sub) => {
    if (!password) return;
    try {
      await disableAdminPush(password, sub.id);
      toast.success("Aparelho removido.");
    } catch {
      toast.error("Não foi possível remover o aparelho.");
    }
    void load();
  };

  const announceUpdate = async () => {
    if (!password || busy) return;
    setBusy(true);
    await notifyUsers(password, "update");
    await supabase.rpc("admin_send_message", {
      _password: password,
      _title: "Atualização disponível",
      _body: "O Atlas VIP foi atualizado. Feche e abra o app novamente para usar a versão mais nova.",
      _target_key_id: null,
    });
    setBusy(false);
    toast.success("Aviso de atualização enviado aos usuários.");
  };

  const adminSubs = subs.filter((s) => (s.scope ?? "admin") === "admin");
  const userSubs = subs.filter((s) => s.scope === "user");
  const canActivate = status === "ready" || status === "enabled";

  return (
    <section className="glass-strong rounded-3xl p-5 space-y-4">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center">
          <Bell className="w-4 h-4" />
        </div>
        <div>
          <p className="vip-eyebrow">Alertas</p>
          <h2 className="font-bold">Notificações no celular</h2>
        </div>
      </header>

      <p className="text-xs text-muted-foreground">{STATUS_TEXT[status]}</p>

      <Button onClick={activate} disabled={!canActivate || busy} className="w-full rounded-2xl">
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : status === "enabled" ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}
        {status === "enabled" ? "Reativar neste aparelho" : "Ativar neste aparelho"}
      </Button>

      <Button
        onClick={announceUpdate}
        disabled={busy}
        variant="outline"
        className="w-full rounded-2xl border-white/10 bg-white/5"
      >
        <Megaphone className="mr-2 h-4 w-4" />
        Avisar atualização do app ({userSubs.length})
      </Button>

      <div className="flex items-start gap-2 rounded-2xl bg-white/5 border border-white/10 p-3">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          No Android funciona no navegador ou no app instalado. No iPhone é preciso abrir pelo ícone
          adicionado à Tela de Início (Safari → Compartilhar → Adicionar à Tela de Início).
        </p>
      </div>

      <div className="space-y-2">
        <p className="vip-eyebrow">Aparelhos do ADM</p>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
        ) : adminSubs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum aparelho cadastrado ainda.</p>
        ) : (
          adminSubs.map((sub) => (
            <div key={sub.id} className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-3 py-2">
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{sub.device ?? "Aparelho"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(sub.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(sub)} className="h-7 w-7 rounded-xl">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
