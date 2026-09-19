import { useEffect, useState } from "react";
import {
  Smartphone,
  Apple,
  Monitor,
  Laptop,
  HelpCircle,
  Users,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import type { LucideIcon } from "lucide-react";

type Stats = {
  total: number;
  android: number;
  ios: number;
  mac: number;
  windows: number;
  linux: number;
  unregistered: number;
};

const ITEMS: { key: keyof Stats; label: string; icon: LucideIcon; color: string }[] = [
  { key: "android", label: "Android", icon: Smartphone, color: "text-status-active" },
  { key: "ios", label: "iOS", icon: Apple, color: "text-status-info" },
  { key: "mac", label: "Mac", icon: Apple, color: "text-foreground" },
  { key: "windows", label: "Windows", icon: Monitor, color: "text-status-info" },
  { key: "linux", label: "Linux", icon: Laptop, color: "text-status-warning" },
  { key: "unregistered", label: "Não reg.", icon: HelpCircle, color: "text-muted-foreground" },
];

export function DeviceStatsCard() {
  const { password } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!password) return;
    let mounted = true;
    const load = async () => {
      const { data, error } = await supabase.rpc("admin_device_stats", {
        _password: password,
      });
      if (!mounted) return;
      if (!error && data) setStats(data as unknown as Stats);
      setLoading(false);
    };
    load();
    const id = setInterval(load, 15_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [password]);

  return (
    <section className="glass-strong rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="vip-eyebrow mb-0.5">Visão geral</p>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Users className="w-4 h-4" />
            Dispositivos por sistema
          </h2>
        </div>
        <span className="text-xs text-muted-foreground">
          Total: <strong className="text-foreground">{stats?.total ?? "—"}</strong>
        </span>
      </div>

      {loading || !stats ? (
        <div className="h-24 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {ITEMS.map(({ key, label, icon: Icon, color }) => (
            <div
              key={key}
              className="rounded-lg bg-white/[0.03] border border-white/5 px-1.5 py-2 text-center"
            >
              <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
              <p className="text-[9px] text-muted-foreground uppercase">
                {label}
              </p>
              <p className="text-base font-bold tabular-nums">
                {stats[key]}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
