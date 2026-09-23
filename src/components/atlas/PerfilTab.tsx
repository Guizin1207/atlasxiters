import { LogOut, Copy, Check, Crown, MessageCircle, ArrowLeft, Smartphone, Globe, Monitor, Wifi, Maximize2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useKey } from "@/lib/key-context";
import { useNavigate } from "react-router-dom";
import { SupportChat } from "@/components/atlas/SupportChat";
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
  const { keyData, signOut, device, adminPreview, closeAdminPanel } = useKey();
  const navigate = useNavigate();
  useTicker(1000); // re-render a cada segundo p/ contador

  const [copied, setCopied] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const deviceInfo = (() => {
    if (typeof navigator === "undefined") return null;
    const ua = navigator.userAgent || "";
    const browser = /edg\//i.test(ua) ? "Microsoft Edge" : /chrome\//i.test(ua) ? "Google Chrome" : /firefox\//i.test(ua) ? "Mozilla Firefox" : /safari\//i.test(ua) && !/chrome|android/i.test(ua) ? "Safari" : "Navegador";
    const os = /iphone|ipad|ipod/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac os x|macintosh/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "Desconhecido";
    const screen = `${window.screen?.width ?? 0} × ${window.screen?.height ?? 0}`;
    const language = navigator.language || "—";
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
    return { browser, os, screen, language, connection: connection ? connection.toUpperCase() : "Indisponível" };
  })();
  if (!keyData) return null;

  const DeviceIcon = getDeviceIcon(device);
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

        {adminPreview ? (
          <div className="rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold">
            Visualização administrativa
          </div>
        ) : (
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
        )}

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Você está usando" value={device} icon={<DeviceIcon className="w-3.5 h-3.5" />} />
          <Stat
            label="Duração"
            value={keyData.is_master ? "Vitalícia" : `${keyData.duration_days}d`}
          />
        </div>
      </div>

      {/* Informações do dispositivo */}
      {deviceInfo && !adminPreview && (
        <div className="glass-strong rounded-2xl p-5 space-y-4">
          <div>
            <p className="vip-eyebrow mb-1">Seu dispositivo</p>
            <h3 className="text-base font-bold">Informações do meu dispositivo</h3>
            <p className="text-[11px] text-muted-foreground mt-1">Dados técnicos básicos deste aparelho e navegador.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Sistema" value={deviceInfo.os} icon={<Smartphone className="w-3.5 h-3.5" />} />
            <Stat label="Navegador" value={deviceInfo.browser} icon={<Globe className="w-3.5 h-3.5" />} />
            <Stat label="Tela" value={deviceInfo.screen} icon={<Maximize2 className="w-3.5 h-3.5" />} />
            <Stat label="Idioma" value={deviceInfo.language} icon={<Monitor className="w-3.5 h-3.5" />} />
            <Stat label="Conexão" value={deviceInfo.connection} icon={<Wifi className="w-3.5 h-3.5" />} />
          </div>
        </div>
      )}

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

      {/* Plano / upgrade compacto */}
      {!adminPreview && (
        <div className="glass-strong rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="vip-eyebrow mb-1">Assinatura</p>
              <h3 className="text-base font-bold truncate">Plano atual</h3>
            </div>
            <PlanBadge plan={keyData.plan} isMaster={keyData.is_master} />
          </div>
          <p className="text-xs text-muted-foreground">Veja os planos disponíveis e solicite uma mudança pelo suporte.</p>
          <button type="button" onClick={() => setSupportOpen(true)} className="w-full h-10 rounded-xl bg-white text-black text-xs font-bold uppercase tracking-[0.1em] hover:bg-white/90 transition-colors">Falar com suporte</button>
        </div>
      )}

      {!adminPreview && (
        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl glass-strong text-sm font-semibold hover:bg-white/10 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Falar com suporte
        </button>
      )}

      {supportOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 sm:items-center"
          onClick={() => setSupportOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="rounded-full bg-black/70 px-3 py-1 text-xs text-white"
              >
                Fechar
              </button>
            </div>
            <SupportChat />
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        onClick={() => {
          if (adminPreview) {
            closeAdminPanel();
            navigate("/admin", { replace: true });
            return;
          }
          signOut();
          toast.message("Sessão encerrada");
        }}
        className="w-full h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-foreground border border-white/10"
      >
        {adminPreview ? <ArrowLeft className="w-4 h-4 mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
        {adminPreview ? "Voltar ao admin" : "Sair"}
      </Button>
    </section>
  );
}


function PlanBadge({ plan, isMaster }: { plan?: string | null; isMaster?: boolean }) {
  const names: Record<string, string> = { demo: "Demo", basic: "Basic", pro: "Pro", bronze: "VIP Bronze", esmeralda: "VIP Esmeralda", rubi: "VIP Rubi", atlas: "VIP Atlas", master: "Master" };
  const label = isMaster ? "Master" : names[String(plan ?? "basic")] ?? "Basic";
  return <span className="shrink-0 rounded-full bg-white text-black px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]">{label}</span>;
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
