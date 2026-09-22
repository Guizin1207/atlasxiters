/** Cartão do admin para ativar notificações push neste aparelho. */
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Trash2, Smartphone, Info, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import { adminPushState, enableAdminPush, disableAdminPush, testAdminPush, testNotification, type PushStatus, type PushSubscriptionRecord, type NotificationTestKind } from "@/lib/push";

type Sub = PushSubscriptionRecord;

const STATUS_TEXT: Record<PushStatus, string> = {
  unsupported: "Este navegador não aceita notificações.",
  "ios-needs-install": "No iPhone, adicione o app à Tela de Início e abra por lá para ativar.",
  denied: "As notificações foram bloqueadas. Libere nas configurações do navegador.",
  unknown: "Não foi possível conferir o cadastro. Atualize ou tente ativar novamente.",
  ready: "Este aparelho ainda não está vinculado às notificações do ADM.",
  enabled: "Este aparelho está cadastrado como ADM chefe para receber mensagens e comprovantes.",
};

export function PushNotificationsCard() {
  const { password } = useAdmin();
  const [status, setStatus] = useState<PushStatus>("ready");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testKey, setTestKey] = useState("");
  const [testKind, setTestKind] = useState<NotificationTestKind | null>(null);
  const load = useCallback(async () => {
    if (!password) { setLoading(false); return; }
    try {
      const state = await adminPushState(password);
      setStatus(state.status);
      setSubs(state.subscriptions);
      setCurrentEndpoint(state.endpoint);
    } catch {
      setStatus("unknown");
    } finally { setLoading(false); }
  }, [password]);

  useEffect(() => {
    void load();
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const activate = async () => {
    if (!password || busy) return;
    setBusy(true);
    setTestResult(null);
    try {
      const next = await enableAdminPush(password);
      setStatus(next);
      if (next === "enabled") toast.success("Este aparelho foi vinculado às notificações do ADM.");
      else toast.error(STATUS_TEXT[next]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível ativar as notificações.");
    }
    setBusy(false);
    void load();
  };

  const remove = async (sub: Sub) => {
    if (!password || busy) return;
    setBusy(true);
    try {
      await disableAdminPush(password, sub.id, sub.endpoint);
      toast.success("Aparelho removido.");
    } catch {
      toast.error("Não foi possível remover o aparelho.");
    } finally { setBusy(false); }
    void load();
  };

  const sendTest = async () => {
    if (!password || busy) return;
    setBusy(true);
    try {
      // Um único toque pode cadastrar o aparelho e, em seguida, testar.
      let current = status;
      if (current !== "enabled") {
        current = await enableAdminPush(password);
        setStatus(current);
        if (current !== "enabled") {
          setTestResult(STATUS_TEXT[current]);
          toast.error(STATUS_TEXT[current]);
          return;
        }
        await load();
      }
      const result = await testAdminPush(password);
      setTestResult(result.code ? `${result.message} Código: ${result.code}${result.httpStatus ? ` · HTTP ${result.httpStatus}` : ""}.` : result.message);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao conferir o aparelho. Tente ativar novamente.";
      setTestResult(message);
      toast.error(message);
    } finally { setBusy(false); }
  };

  const runNotificationTest = async (kind: NotificationTestKind) => {
    if (!password || busy) return;
    const needsKey = !["message", "receipt"].includes(kind);
    if (needsKey && !testKey.trim()) {
      toast.error("Informe a key do usuário para este teste.");
      return;
    }
    setBusy(true);
    setTestKind(kind);
    setTestResult(null);
    try {
      const result = await testNotification(password, kind, needsKey ? testKey : undefined);
      const detail = result.code
        ? `${result.message} Código: ${result.code}${result.httpStatus ? ` · HTTP ${result.httpStatus}` : ""}.`
        : result.message;
      setTestResult(detail);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha no teste da notificação.";
      setTestResult(message);
      toast.error(message);
    } finally {
      setTestKind(null);
      setBusy(false);
    }
  };

  const adminSubs = subs.filter((s) => (s.scope ?? "admin") === "admin");
  const userSubs = subs.filter((s) => s.scope === "user");
  const canActivate = status === "ready" || status === "enabled" || status === "unknown";

  return (
    <section className="glass-strong rounded-3xl p-5 space-y-4">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl glass flex items-center justify-center">
          <Bell className="w-4 h-4" />
        </div>
        <div>
          <p className="vip-eyebrow">Alertas</p>
          <h2 className="font-bold">Notificações do ADM chefe</h2>
        </div>
      </header>

      <p className="text-xs text-muted-foreground">{STATUS_TEXT[status]}</p>

      <Button onClick={activate} disabled={!canActivate || busy || loading} className="w-full rounded-2xl">
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : status === "enabled" ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}
        {status === "enabled" ? "Reativar vínculo de ADM" : "Vincular este aparelho ao ADM"}
      </Button>

      <p className="text-[11px] text-muted-foreground">
        O vínculo vale só para notificações: o login de ADM continua obrigatório.
        Você pode ativar vários aparelhos. Os avisos de ADM e de usuário ficam separados,
        mesmo quando os dois acessos são usados neste celular.
      </p>
      <Button onClick={sendTest} disabled={busy || status === "denied" || status === "unsupported" || status === "ios-needs-install" || loading} variant="outline" className="w-full rounded-2xl">
        <Bell className="mr-2 h-4 w-4" /> Testar neste aparelho
      </Button>
      {testResult && <p role="status" className="text-xs text-muted-foreground">{testResult}</p>}

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <p className="vip-eyebrow">Testes individuais</p>
          <p className="text-xs text-muted-foreground">Teste cada tipo de notificação separadamente.</p>
        </div>

        <input
          value={testKey}
          onChange={(e) => setTestKey(e.target.value)}
          placeholder="Key do usuário para testes"
          className="h-10 w-full rounded-xl border border-white/10 bg-background px-3 text-sm outline-none focus:border-primary/50"
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="outline" className="justify-start rounded-xl" disabled={busy || loading} onClick={() => runNotificationTest("user_test")}>
            {testKind === "user_test" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Teste do usuário
          </Button>
          <Button variant="outline" className="justify-start rounded-xl" disabled={busy || loading} onClick={() => runNotificationTest("message")}>
            {testKind === "message" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Nova mensagem ADM
          </Button>
          <Button variant="outline" className="justify-start rounded-xl" disabled={busy || loading} onClick={() => runNotificationTest("receipt")}>
            {testKind === "receipt" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Novo comprovante ADM
          </Button>
          <Button variant="outline" className="justify-start rounded-xl" disabled={busy || loading} onClick={() => runNotificationTest("reply")}>
            {testKind === "reply" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Resposta do suporte
          </Button>
          <Button variant="outline" className="justify-start rounded-xl" disabled={busy || loading} onClick={() => runNotificationTest("notice")}>
            {testKind === "notice" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Novo aviso
          </Button>
          <Button variant="outline" className="justify-start rounded-xl" disabled={busy || loading} onClick={() => runNotificationTest("update")}>
            {testKind === "update" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Atualização
          </Button>
          <Button variant="outline" className="justify-start rounded-xl" disabled={busy || loading} onClick={() => runNotificationTest("maintenance")}>
            {testKind === "maintenance" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Manutenção
          </Button>
          <Button variant="outline" className="justify-start rounded-xl" disabled={busy || loading} onClick={() => runNotificationTest("maintenance_end")}>
            {testKind === "maintenance_end" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Fim da manutenção
          </Button>
          <Button variant="outline" className="justify-start rounded-xl" disabled={busy || loading} onClick={() => runNotificationTest("coins_added")}>
            {testKind === "coins_added" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Coins recebidos
          </Button>
          <Button variant="outline" className="justify-start rounded-xl" disabled={busy || loading} onClick={() => runNotificationTest("reward_ready")}>
            {testKind === "reward_ready" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Recompensa disponível
          </Button>
          <Button variant="outline" className="justify-start rounded-xl" disabled={busy || loading} onClick={() => runNotificationTest("daily_reward")}>
            {testKind === "daily_reward" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Coin diário disponível
          </Button>
          <Button variant="outline" className="justify-start rounded-xl" disabled={busy || loading} onClick={() => runNotificationTest("expired")}>
            {testKind === "expired" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Key expirada
          </Button>
        </div>
      </div>



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
                {sub.endpoint === currentEndpoint && <p className="text-xs text-status-active">Este aparelho · ADM chefe</p>}
                <p className="text-[10px] text-muted-foreground">
                  {new Date(sub.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <Button size="icon" variant="ghost" disabled={busy} aria-label={`Remover ${sub.endpoint === currentEndpoint ? "este aparelho" : sub.device ?? "aparelho"}`} onClick={() => remove(sub)} className="h-7 w-7 rounded-xl">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
