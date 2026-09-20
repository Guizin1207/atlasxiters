import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/admin-context";
import { currentAdminSessionId, listAdminSessions, type AdminAccessSession } from "@/lib/admin-devices";
import { Button } from "@/components/ui/button";

export function AdminDevicesCard() {
  const { password, deviceRegistryError } = useAdmin();
  const [rows, setRows] = useState<AdminAccessSession[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!password) return;
    let live = true;
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try { const data = await listAdminSessions(password); if (live) { setRows(data); setError(false); } }
      catch { if (live) setError(true); }
      finally { busy = false; if (live) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 30_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [password, refresh]);
  const date = (value: string) => new Date(value).toLocaleString("pt-BR");
  return <section className="glass-strong rounded-2xl p-4 space-y-3">
    <div className="flex justify-between items-center gap-3"><h2 className="font-bold">Aparelhos com acesso ADM</h2><Button variant="outline" size="sm" onClick={() => setRefresh(n => n + 1)}>Atualizar</Button></div>
    <p className="text-xs text-muted-foreground">Histórico dos últimos 100 acessos registrados. A mesma senha identifica o aparelho e o navegador, não o nome da pessoa. Registros começam após ativar este recurso.</p>
    {(error || deviceRegistryError) && <p role="alert" className="text-sm text-status-warning">Não foi possível consultar ou registrar todos os acessos. A configuração de aparelhos ADM precisa estar aplicada no banco e a conexão disponível.</p>}
    {loading ? <p>Carregando aparelhos…</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left">
      <thead><tr className="border-b border-white/10"><th className="p-2">Aparelho</th><th className="p-2">Primeiro acesso</th><th className="p-2">Última atividade</th><th className="p-2">Situação</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.session_id} className="border-b border-white/5">
        <td className="p-2"><span className="block">{row.device_label}{row.session_id === currentAdminSessionId() ? " · Esta sessão" : ""}</span><span className="text-xs text-muted-foreground">Aparelho {row.device_id?.slice(0, 8) ?? "não informado"}</span></td>
        <td className="p-2 whitespace-nowrap">{date(row.created_at)}</td><td className="p-2 whitespace-nowrap">{date(row.last_seen_at)}</td>
        <td className="p-2 whitespace-nowrap">{row.ended_at ? "Saiu do ADM" : Date.now() - new Date(row.last_seen_at).getTime() < 120_000 ? "Atividade recente" : "Sem atividade recente"}</td>
      </tr>)}</tbody>
    </table>{!rows.length && !error && <p className="p-2 text-muted-foreground">Nenhum acesso registrado ainda.</p>}</div>}
  </section>;
}
