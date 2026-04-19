import { LogOut, Copy, Check, Crown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useKey } from "@/lib/key-context";
import { useTicker } from "@/hooks/use-ticker";
import {
  formatCountdown,
  getDeviceIcon,
  maskKey,
  msUntil,
} from "@/lib/atlas-utils";
import { cn } from "@/lib/utils";

/**
 * Aba "Perfil" — chave (mascarada/copiável), dispositivo, contador regressivo ao vivo.
 */
export function PerfilTab() {
  const { keyData, signOut } = useKey();
  useTicker(1000); // re-render a cada segundo p/ contador

  const [copied, setCopied] = useState(false);
  if (!keyData) return null;

  const DeviceIcon = getDeviceIcon(keyData.device);
  const remaining = keyData.is_master ? Infinity : msUntil(keyData.expires_at);
  const warn = isFinite(remaining) && remaining < 86_400_000; // <24h
  const expired = isFinite(remaining) && remaining <= 0;

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(keyData.key);
      setCopied(true);
      toast.success("Chave copiada");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <section aria-label="Perfil" className="space-y-5">
      <div>
        <p className="vip-eyebrow mb-1">Sua conta</p>
        <h2 className="text-xl font-bold">Perfil</h2>
      </div>

      {/* Card da chave */}
      <div className="glass-strong rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="vip-eyebrow">Chave de acesso</span>
          {keyData.is_master && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] bg-white text-black rounded-full px-2 py-1 font-bold">
              <Crown className="w-3 h-3" />
              Master
            </span>
          )}
        </div>

        <button
          onClick={copyKey}
          className="w-full text-left flex items-center justify-between gap-3 bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 transition-colors"
          aria-label="Copiar chave"
        >
          <span className="font-mono text-sm tracking-wider truncate">
            {maskKey(keyData.key)}
          </span>
          {copied ? (
            <Check className="w-4 h-4 text-status-active shrink-0" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Dispositivo" value={keyData.device ?? "—"} icon={<DeviceIcon className="w-3.5 h-3.5" />} />
          <Stat
            label="Duração"
            value={keyData.is_master ? "Vitalícia" : `${keyData.duration_days}d`}
          />
        </div>
      </div>

      {/* Contador */}
      <div className="glass-strong rounded-2xl p-5">
        <p className="vip-eyebrow mb-3">Tempo restante</p>
        <div
          className={cn(
            "font-mono text-2xl font-bold tabular-nums tracking-wider",
            expired
              ? "text-status-danger"
              : warn
              ? "text-status-warning"
              : "text-status-active"
          )}
        >
          {formatCountdown(remaining)}
        </div>
        {keyData.expires_at && !keyData.is_master && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Expira em{" "}
            {new Date(keyData.expires_at).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        onClick={() => {
          signOut();
          toast.message("Sessão encerrada");
        }}
        className="w-full h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-foreground border border-white/10"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sair
      </Button>
    </section>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
        {label}
      </p>
      <div className="flex items-center gap-2 font-semibold text-sm">
        {icon}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}
