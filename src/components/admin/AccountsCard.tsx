import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2, History, KeyRound, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";

type Account = { user_id: string; username: string; key: string | null; plan: string | null; device: string | null; status: string; blocked: boolean; is_master: boolean; created_at: string; last_sign_in_at: string | null; key_expires_at: string | null };
type Entry = { id: string; function_name: string; enabled: boolean; created_at: string };
const statuses: Record<string, string> = { active: "Ativo", blocked: "Bloqueado", revoked: "Key revogada", expired: "Expirado", no_key: "Sem key" };
const errors: Record<string, string> = { unauthorized: "Entre novamente no ADM.", protected_account: "Contas com key mestra são protegidas.", weak_password: "Use 8 a 72 caracteres, com maiúscula, minúscula e número.", leaked_password: "Escolha uma senha menos comum.", delete_failed_access_revoked: "A exclusão falhou. A conta foi preservada, mas as keys foram revogadas por segurança.", delete_failed: "Não foi possível excluir a conta.", update_failed: "Não foi possível alterar a conta." };
const date = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";

export function AccountsCard({ clients = false }: { clients?: boolean }) {
  const { password } = useAdmin();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<{ account: Account; action: "block" | "unblock" | "delete" } | null>(null);
  const [historyUser, setHistoryUser] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const load = useCallback(async () => {
    if (!password) return;
    setLoading(true); setError("");
    const { data, error: failure } = await supabase.rpc("admin_list_users", { _password: password });
    if (failure) setError("Não foi possível carregar as contas. " + failure.message);
    else setAccounts(Array.isArray(data) ? data as unknown as Account[] : []);
    setLoading(false);
  }, [password]);
  useEffect(() => { void load(); }, [load]);
  const perform = async (account: Account, action: string, newPassword?: string) => {
    if (!password || busy) return;
    setBusy(account.user_id);
    try {
      const { data, error: failure } = await supabase.functions.invoke("admin-reset-password", { body: { admin_password: password, user_id: account.user_id, action, new_password: newPassword } });
      let payload = data;
      if (failure) payload = await (failure as { context?: Response }).context?.json().catch(() => null);
      if (failure || !payload?.ok) throw new Error(errors[payload?.error] ?? "Não foi possível concluir. Tente novamente.");
      toast.success(action === "delete" ? "Conta excluída e keys revogadas." : action === "block" ? "Conta bloqueada e acesso desconectado." : action === "unblock" ? "Conta liberada. O prazo das keys foi mantido." : "Senha redefinida.");
      if (payload.warning) toast.warning(payload.warning);
      await load();
    } catch (failure) { toast.error(failure instanceof Error ? failure.message : "Não foi possível concluir."); }
    finally { setBusy(null); setPending(null); }
  };
  const showHistory = async (userId: string) => {
    if (!password) return;
    setHistoryUser(userId); setHistoryLoading(true); setHistoryError(""); setEntries([]);
    const { data, error: failure } = await supabase.rpc("admin_client_history", { _password: password, _user_id: userId });
    if (failure) setHistoryError("Não foi possível carregar o histórico. " + failure.message);
    else setEntries(Array.isArray(data) ? data as unknown as Entry[] : []);
    setHistoryLoading(false);
  };
  const visible = accounts.filter(account => (status === "all" || account.status === status) && `${account.username} ${account.key ?? ""} ${account.device ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-4">
    <header className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{clients ? "Clientes" : "Contas"} <span className="text-sm text-muted-foreground">{accounts.length}</span></h2><Button variant="outline" size="icon" onClick={load} disabled={loading} aria-label="Atualizar contas"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button></header>
    <div className="flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar cliente, key ou aparelho" className="pl-9" aria-label="Buscar clientes" /></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(statuses).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
    {error ? <p role="alert" className="text-sm text-status-danger">{error}</p> : loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : !visible.length ? <p className="py-8 text-center text-muted-foreground">Nenhuma conta encontrada.</p> : <div className="grid gap-3 lg:grid-cols-2">{visible.map(account => <article key={account.user_id} className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words font-semibold">{account.username || "Sem nome"}</h3><span className={`shrink-0 text-xs ${account.status === "blocked" || account.status === "revoked" ? "text-status-danger" : "text-muted-foreground"}`}>{statuses[account.status] ?? account.status}</span></div>
      <p className="mt-2 break-all font-mono text-xs">{account.key || "Sem key vinculada"}</p><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted-foreground">Plano</dt><dd>{account.plan ?? "—"}</dd></div><div><dt className="text-muted-foreground">Aparelho</dt><dd className="break-words">{account.device ?? "—"}</dd></div><div><dt className="text-muted-foreground">Último acesso</dt><dd>{date(account.last_sign_in_at)}</dd></div><div><dt className="text-muted-foreground">Expira</dt><dd>{account.key_expires_at ? date(account.key_expires_at) : "Sem prazo"}</dd></div></dl>
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!!busy || account.is_master} onClick={() => setPending({ account, action: account.blocked ? "unblock" : "block" })}>{account.blocked ? <CheckCircle2 className="mr-1.5 h-4 w-4" /> : <Ban className="mr-1.5 h-4 w-4" />}{account.blocked ? "Liberar" : "Bloquear"}</Button><Button variant="outline" size="sm" disabled={!!busy} onClick={() => { const pwd = window.prompt(`Nova senha para ${account.username}:`); if (pwd !== null) void perform(account, "password", pwd); }}><KeyRound className="mr-1.5 h-4 w-4" />Senha</Button><Button variant="outline" size="sm" onClick={() => void showHistory(account.user_id)}><History className="mr-1.5 h-4 w-4" />Histórico</Button><Button variant="destructive" size="sm" disabled={!!busy || account.is_master} onClick={() => setPending({ account, action: "delete" })}><Trash2 className="mr-1.5 h-4 w-4" />Excluir</Button></div>
      {historyUser === account.user_id && <div className="mt-4 border-t border-border pt-3"><div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-semibold">Histórico de funções</h4><Button variant="ghost" size="sm" onClick={() => setHistoryUser(null)}>Fechar</Button></div>{historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : historyError ? <p role="alert" className="text-xs text-status-danger">{historyError}</p> : !entries.length ? <p className="text-xs text-muted-foreground">Nenhuma alteração registrada desde a ativação do histórico.</p> : <ol className="max-h-72 space-y-3 overflow-y-auto">{entries.map(entry => <li key={entry.id} className="flex items-start justify-between gap-3 text-xs"><div><p className="font-medium">{entry.function_name}</p><time className="text-muted-foreground">{date(entry.created_at)}</time></div><span className={entry.enabled ? "text-status-active" : "text-muted-foreground"}>{entry.enabled ? "Ativou" : "Desativou"}</span></li>)}</ol>}</div>}
    </article>)}</div>}
    <AlertDialog open={!!pending} onOpenChange={open => { if (!open && !busy) setPending(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{pending?.action === "delete" ? "Excluir conta?" : pending?.action === "block" ? "Bloquear conta?" : "Liberar conta?"}</AlertDialogTitle><AlertDialogDescription>{pending?.account.username}: {pending?.action === "delete" ? "A conta será excluída definitivamente. Suas keys serão revogadas para impedir acesso antigo." : pending?.action === "block" ? "Todas as keys desta conta serão bloqueadas. O acesso será desconectado na próxima verificação." : "Libera somente as keys bloqueadas por esta ação, sem alterar a data de expiração."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={!!busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={!!busy} onClick={event => { event.preventDefault(); if (pending) void perform(pending.account, pending.action); }}>{busy ? "Aguarde..." : "Confirmar"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}