import { useEffect, useState } from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAdmin } from "@/lib/admin-context";
import { supabase } from "@/integrations/supabase/client";
import {
  clearAdminDevices,
  currentAdminDeviceId,
  currentAdminSessionId,
  listAdminSessions,
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
        if (!keysResult.error) {
          for (const key of (keysResult.data ?? []) as any[]) {
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

  const date = (value: string) => new Date(value).toLocaleString("pt-BR");
  const currentDeviceId = currentAdminDeviceId();

  return (
    <section className="glass-strong rounded-2xl p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="vip-eyebrow">Segurança</p>
          <h2 className="font-bold">Dispositivos ADM</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Cada aparelho aparece uma única vez. Novos acessos apenas atualizam o registro.
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
                <th className="p-2">Acesso / Key</th>\n                <th className="p-2">Primeiro registro</th>
                <th className="p-2">Última atividade</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isCurrent = row.device_id === currentDeviceId;
                const active = !row.ended_at && Date.now() - new Date(row.last_seen_at).getTime() < 120_000;

                return (
                  <tr key={row.device_id ?? row.session_id} className="border-b border-white/5">
                    <td className="p-2">
                      <span className="block font-medium">
                        {row.device_label}
                        {isCurrent ? " · Este dispositivo" : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ID {row.device_id?.slice(0, 8) ?? "não informado"}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="font-medium">ADM</div>
                      {(keysByDevice[row.device_id ?? ""] ?? []).length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Normal: {(keysByDevice[row.device_id ?? ""] ?? []).join(", ")}
                        </div>
                      )}
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
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!rows.length && !error && (
            <p className="p-2 text-muted-foreground">Nenhum dispositivo registrado.</p>
          )}
        </div>
      )}
    </section>
  );
}
