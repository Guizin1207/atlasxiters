import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, ShieldCheck, ShieldX, Trash2 } from "lucide-react";
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
  const [keysByDevice, setKeysByDevice] = useState<Record<string, string[]>>({});
  const [linkedDevices, setLinkedDevices] = useState<any[]>([]);
  const [processingDevice, setProcessingDevice] = useState<string | null>(null);

  useEffect(() => {
    if (!password) return;
    let live = true;
    let busy = false;

    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const [data, keysResult] = await Promise.all([
          listAdminSessions(password),
          supabase.rpc("admin_list_keys", { _password: password }),
        ]);
        const map: Record<string, string[]> = {};
        const keyRows = !keysResult.error && Array.isArray(keysResult.data) ? keysResult.data as any[] : [];
        if (!keysResult.error) {
          for (const key of keyRows) {
            if (!key.device_id) continue;
            if (!map[key.device_id]) map[key.device_id] = [];
            map[key.device_id].push(key.key);
          }
        }
        if (live) {
          const unique = new Map<string, AdminAccessSession>();
          for (const row of data) {
            const id = row.device_id ?? row.session_id;
            const previous = unique.get(id);
            if (!previous || new Date(row.last_seen_at).getTime() > new Date(previous.last_seen_at).getTime()) unique.set(id, row);
          }
          setRows(Array.from(unique.values()));
          setKeysByDevice(map);
          const devices = new Map<string, any>();
          for (const key of keyRows) {
            if (!key.device_id) continue;
            const id = String(key.device_id);
            const previous = devices.get(id);
            if (!previous || new Date(key.activated_at ?? 0).getTime() > new Date(previous.activated_at ?? 0).getTime()) devices.set(id, key);
          }
          setLinkedDevices(Array.from(devices.values()));
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

  const date = (value: string) => new Date(value).toLocaleString("pt-BR");

  const currentDeviceId = currentAdminDeviceId();

  return (
    <section className="glass-strong rounded-2xl p-4 space-y-4">
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
        <div>
          <h3 className="font-semibold">Dispositivos vinculados às keys</h3>
          <p className="text-xs text-muted-foreground">Aparelhos registrados nas chaves de usuários.</p>
        </div>
        {linkedDevices.length ? (
          <div className="space-y-2">
            {linkedDevices.map((item) => (
              <div key={String(item.device_id)} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.device || "Dispositivo não identificado"}</p>
                  <p className="text-xs text-muted-foreground font-mono break-all">{String(item.device_id).slice(0, 8)}… · {item.customer_name || "Usuário"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono">{item.key || "Key não disponível"}</p>
                  <p className="text-[10px] text-muted-foreground">{item.plan || "Free"} · {item.revoked ? "Revogada" : "Vinculada"}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum aparelho vinculado a uma key foi encontrado.</p>
        )}
      </div>
    </section>
  );
}
