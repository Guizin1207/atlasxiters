import { Bell, Vibrate, Wand2, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePanelSettings } from "@/hooks/use-panel-settings";

/**
 * Aba "Ajustes" — preferências persistidas em key_settings.
 */
export function AjustesTab() {
  const { settings, update, loading, saving } = usePanelSettings();

  if (loading) {
    return (
      <div className="glass-strong rounded-2xl h-32 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section aria-label="Ajustes" className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="vip-eyebrow mb-1">Preferências</p>
          <h2 className="text-xl font-bold">Ajustes</h2>
        </div>
        {saving && (
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground animate-pulse-soft">
            Salvando…
          </span>
        )}
      </div>

      <div className="glass-strong rounded-2xl divide-y divide-white/5">
        <Row
          icon={<Bell className="w-4 h-4" />}
          title="Notificações"
          desc="Receba alertas do administrador."
          checked={!!settings.notifications}
          onChange={(v) => update({ notifications: v })}
        />
        <Row
          icon={<Vibrate className="w-4 h-4" />}
          title="Vibração"
          desc="Feedback tátil em ações importantes."
          checked={!!settings.haptics}
          onChange={(v) => update({ haptics: v })}
        />
        <Row
          icon={<Wand2 className="w-4 h-4" />}
          title="Animações reduzidas"
          desc="Diminui efeitos visuais."
          checked={!!settings.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
        />
      </div>
    </section>
  );
}

function Row({
  icon,
  title,
  desc,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-4">
      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
