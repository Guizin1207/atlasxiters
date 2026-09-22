import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/lib/admin-context";
import { supabase } from "@/integrations/supabase/client";

type SecurityEvent = {
  id: string;
  reason: string;
  key_hint: string | null;
  device_id: string | null;
  device: string | null;
  created_at: string;
  notified_at: string | null;
};

const labels: Record<string, string> = {
  invalid_key: "Key inválida / aleatória",
  revoked_key: "Key revogada",
  device_mismatch: "Key usada em outro dispositivo",
};

export function SecurityCard() {
  const { password } = useAdmin();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!password) return;
    setLoading(true);
    const { data } = await supabase.rpc("admin_list_security_events", { _password: password });
    setEvents((data ?? []) as SecurityEvent[]);
    setLoading(false);
  }, [password]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const suspicious = events.filter((e) => e.reason !== "device_mismatch").length;
  const sharing = events.filter((e) => e.reason === "device_mismatch").length;

  return (
    <div className="space-y-5">
      <section className="glass-strong rounded-3xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="vip-eyebrow">Proteção Atlas</p>
            <h2 className="text-xl font-bold">🛡️ Anti-burla / Anti-compartilhamento</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tentativas de key inválida, key revogada e uso da mesma key em outro dispositivo são registradas.
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Atualizar">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/[0.03] p-4">
            <p className="text-xs text-muted-foreground">Tentativas suspeitas</p>
            <p className="mt-1 text-2xl font-bold">{suspicious}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.03] p-4">
            <p className="text-xs text-muted-foreground">Possível compartilhamento</p>
            <p className="mt-1 text-2xl font-bold">{sharing}</p>
          </div>
        </div>
      </section>

      <section className="glass-strong rounded-3xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <h3 className="font-bold">Registro de segurança</h3>
        </div>

        {loading && !events.length ? (
          <p className="text-sm text-muted-foreground">Carregando registros...</p>
        ) : !events.length ? (
          <div className="rounded-2xl border border-white/10 p-5 text-center text-sm text-muted-foreground">
            Nenhuma tentativa suspeita registrada.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start gap-3">
                  {event.reason === "device_mismatch" ? (
                    <Smartphone className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{labels[event.reason] ?? "Tentativa suspeita"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString("pt-BR")}
                      {event.device ? ` • ${event.device}` : ""}
                      {event.key_hint ? ` • final da key: ****${event.key_hint}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {event.notified_at ? "Alerta enviado ao ADM" : "Alerta pendente"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
