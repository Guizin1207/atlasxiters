import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Clock3, RotateCcw, ShieldCheck, ShieldX, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/lib/admin-context";
import { supabase } from "@/integrations/supabase/client";
import {
  clearAdminDevices,
  currentAdminDeviceId,
  listAdminSessions,
  setAdminDeviceApproval,
  type AdminAccessSession,
} from "@/lib/admin-devices";
import { Button } from "@/components/ui/button";

export function AdminDevicesCard() {
  const { password, deviceRegistryError } = useAdmin();
  const [rows, setRows] = useState<AdminAccessSession[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [linkedDevices, setLinkedDevices] = useState<any[]>([]);
  const [pushDevices, setPushDevices] = useState<any[]>([]);
  const [processingDevice, setProcessingDevice] = useState<string | null>(null);
  const [resettingKeyId, setResettingKeyId] = useState<string | null>(null);

  useEffect(() => {
    if (!password) return;
    let live = true;
    let busy = false;

    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const [data, keysResult, pushResult] = await Promise.all([
          listAdminSessions(password),
          supabase.rpc("admin_list_keys", { _password: password }),
          supabase.rpc("admin_list_push_subscriptions", { _password: password }),
        ]);
        const keyRows = !keysResult.error && Array.isArray(keysResult.data) ? keysResult.data as any[] : [];
        const pushRows = !pushResult.error && Array.isArray(pushResult.data) ? pushResult.data as any[] : [];
        if (live) {
          const unique = new Map<string, AdminAccessSession>();
          for (const row of data) {
            const id = row.device_id ?? row.session_id;
            const previous = unique.get(id);
            if (!previous || new Date(row.last_seen_at).getTime() > new Date(previous.last_seen_at).getTime()) unique.set(id, row);
          }
          setRows(Array.from(unique.values()));
          const connected = keyRows
            .filter((key) => Boolean(key.device_id || (key.activated_at && key.device)))
            .sort((a, b) => new Date(b.activated_at ?? b.created_at ?? 0).getTime() - new Date(a.activated_at ?? a.created_at ?? 0).getTime());
          setLinkedDevices(connected);
          setPushDevices(pushRows);
          setError(false);
        }
      } catch {
        if (live) setError(true);
      } finally {
        busy = false;
        if (live) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 30_000);

    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [password, refresh]);

  const clean = async () => {
    if (!password || cleaning) return;
    if (!window.confirm("Limpar os dispositivos antigos/inativos? O dispositivo atual será mantido.")) return;

    setCleaning(true);
    try {
      const removed = await clearAdminDevices(password);
      toast.success(removed ? `${removed} dispositivo(s) removido(s).` : "Nenhum dispositivo antigo para remover.");
      setRefresh((value) => value + 1);
    } catch {
      toast.error("Não foi possível limpar os dispositivos. Atualize o painel e tente novamente.");
    } finally {
      setCleaning(false);
    }
  };

  const approveDevice = async (deviceId: string, approved: boolean) => {
    if (!password || processingDevice) return;
    setProcessingDevice(deviceId);
    try {
      await setAdminDeviceApproval(password, deviceId, approved);
      toast.success(approved ? "Dispositivo aprovado." : "Dispositivo bloqueado.");
      setRefresh((value) => value + 1);
    } catch {
      toast.error("Não foi possível atualizar este dispositivo.");
    } finally {
      setProcessingDevice(null);
    }
  };

  const resetKeyDevice = async (keyId: string) => {
    if (!password || resettingKeyId) return;
    setResettingKeyId(keyId);
    const { error: resetErr } = await supabase.rpc("admin_reset_device", { _id: keyId, _password: password });
    setResettingKeyId(null);
    if (resetErr) toast.error("Não foi possível desvincular este aparelho.");
    else { toast.success("Aparelho desvinculado da key."); setRefresh((v) => v + 1); }
  };

  const date = (value: string) => new Date(value).toLocaleString("pt-BR");

  const currentDeviceId = currentAdminDeviceId();
  const pushKeyIds = new Set(pushDevices.filter((p) => p.scope === "user" && p.key_id).map((p) => String(p.key_id)));
  const userPushCount = pushDevices.filter((p) => p.scope === "user").length;

  return (
    <section className="glass-strong rounded-2xl p-4 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ADM</p>
          <p className="text-lg font-bold">{rows.length}</p>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Clientes</p>
          <p className="text-lg font-bold">{linkedDevices.length}</p>
        </div>
        <div className="rounded-xl bg-white/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Com Push</p>
          <p className="text-lg font-bold">{userPushCount}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="vip-eyebrow">Segurança</p>
          <h2 className="font-bold">Dispositivos ADM</h2>
          <p className="text-xs text-muted-foreground mt-1">
            O acesso ADM é protegido pela senha mestra. Esta lista serve apenas para visualizar os dispositivos que acessaram o painel.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRefresh((value) => value + 1)}>
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={clean} disabled={cleaning}>
            <Trash2 className="w-4 h-4 mr-1" />
            {cleaning ? "Limpando..." : "Limpar dispositivos"}
          </Button>
        </div>
      </div>

      {(error || deviceRegistryError) && (
        <p role="alert" className="text-sm text-status-warning">
          Não foi possível consultar todos os dispositivos.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando dispositivos…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="p-2">Dispositivo</th>
                <th className="p-2">Sessão criada</th>
                <th className="p-2">Última atividade</th>
                <th className="p-2">Status</th>
                <th className="p-2">Aprovação</th>
                
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isCurrent = row.device_id === currentDeviceId;
                const active = !row.ended_at && Date.now() - new Date(row.last_seen_at).getTime() < 120_000;

                return (
                  <tr key={row.device_id ?? row.session_id} className="border-b border-white/5">

                    <td className="p-2">
                      <div className="font-medium">{row.device_label || "Dispositivo ADM"}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{isCurrent ? "Este aparelho" : "Acesso administrativo"}</div>
                    </td>
                    <td className="p-2 whitespace-nowrap">{date(row.created_at)}</td>
                    <td className="p-2 whitespace-nowrap">{date(row.last_seen_at)}</td>
                    <td className="p-2 whitespace-nowrap">
                      {active ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                        </span>
                      ) : row.ended_at ? (
                        "Saiu do ADM"
                      ) : (
                        "Sem atividade recente"
                      )}
                    </td>
                    <td className="p-2">
                      {row.is_primary ? (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold">
                          <ShieldCheck className="w-4 h-4" /> ADM principal
                        </span>
                      ) : row.approval_status === "pending" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-status-warning">
                            <Clock3 className="w-4 h-4" /> Aguardando
                          </span>
                          {!isCurrent && (
                            <>
                              <Button size="sm" onClick={() => void approveDevice(row.device_id!, true)} disabled={processingDevice === row.device_id}>
                                <ShieldCheck className="w-4 h-4 mr-1" /> Aprovar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => void approveDevice(row.device_id!, false)} disabled={processingDevice === row.device_id}>
                                <ShieldX className="w-4 h-4 mr-1" /> Desaprovar
                              </Button>
                            </>
                          )}
                        </div>
                      ) : row.approval_status === "denied" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-status-danger"><ShieldX className="w-4 h-4" /> Bloqueado</span>
                          {!isCurrent && (
                            <Button size="sm" variant="outline" onClick={() => void approveDevice(row.device_id!, true)} disabled={processingDevice === row.device_id}>
                              Aprovar
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-status-success"><ShieldCheck className="w-4 h-4" /> Aprovado</span>
                          {!isCurrent && (
                            <Button size="sm" variant="destructive" onClick={() => void approveDevice(row.device_id!, false)} disabled={processingDevice === row.device_id}>
                              Desaprovar
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!rows.length && !error && (
            <p className="p-2 text-muted-foreground">Nenhuma sessão ADM registrada.</p>
          )}
        </div>
      )}

      <div className="space-y-3 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Smartphone className="w-4 h-4" />Todos os dispositivos conectados ({linkedDevices.length})</h3>
            <p className="text-xs text-muted-foreground">Todos os aparelhos ativos ou vinculados às keys dos usuários.</p>
          </div>
        </div>
        {linkedDevices.length ? (
          <div className="space-y-2">
            {linkedDevices.map((item) => {
              const hasPush = pushKeyIds.has(String(item.id));
              return (
                <div key={String(item.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{item.device || "Dispositivo não identificado"}</p>
                      {hasPush && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium">
                          <Bell className="w-2.5 h-2.5" /> Push
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      {item.device_id ? `${String(item.device_id).slice(0, 8)}…` : "Universal"} · {item.customer_name || "Usuário"}
                      {item.activated_at ? ` · ${date(item.activated_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-xs font-mono">{item.key || "Key não disponível"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.is_universal || item.plan === "free" ? "Universal Free" : item.plan || "Basic"} · {item.revoked ? "Revogada" : "Conectado"}
                      </p>
                    </div>
                    {item.device_id && !item.is_master && !item.is_universal && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void resetKeyDevice(String(item.id))}
                        disabled={resettingKeyId === String(item.id)}
                        className="h-8 rounded-lg px-2.5 text-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Liberar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum aparelho vinculado a uma key foi encontrado.</p>
        )}
      </div>
    </section>
  );
}
