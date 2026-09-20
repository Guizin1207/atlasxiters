/** Linha de ativação das notificações no aparelho do usuário. */
import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useKey } from "@/lib/key-context";
import { currentPushStatus, enableUserPush, disableUserPush, type PushStatus } from "@/lib/push";

const STATUS_TEXT: Record<PushStatus, string> = {
  unsupported: "Este navegador não aceita notificações.",
  "ios-needs-install": "No iPhone, adicione o app à Tela de Início e abra por lá.",
  denied: "Notificações bloqueadas. Libere nas configurações do navegador.",
  unknown: "Não foi possível conferir o cadastro. Tente ativar novamente.",
  "admin-device": "Este aparelho recebe os avisos do ADM. Gerencie o vínculo no painel administrativo.",
  ready: "Ativar avisos do suporte, atualizações e manutenção.",
  enabled: "Avisos ativados para esta key neste aparelho.",
};

export function UserPushRow() {
  const { keyData } = useKey();
  const [status, setStatus] = useState<PushStatus>("ready");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus("ready");
    void currentPushStatus(keyData?.key).then((next) => { if (active) setStatus(next); });
    return () => { active = false; };
  }, [keyData?.key]);

  const toggle = async () => {
    if (!keyData?.key || busy) return;
    setBusy(true);
    try {
      if (status === "enabled") {
        await disableUserPush(keyData.key);
        setStatus("ready");
        toast.success("Avisos desativados neste aparelho.");
      } else {
        const next = await enableUserPush(keyData.key);
        setStatus(next);
        if (next === "enabled") toast.success("Avisos ativados neste aparelho.");
        else toast.error(STATUS_TEXT[next]);
      }
    } catch {
      toast.error("Não foi possível alterar os avisos.");
    }
    setBusy(false);
  };

  const canToggle = status === "ready" || status === "enabled" || status === "unknown";

  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div className="w-9 h-9 rounded-xl glass flex items-center justify-center shrink-0">
        <BellRing className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Avisos no celular</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{STATUS_TEXT[status]}</p>
      </div>
      <Button
        size="sm"
        variant={status === "enabled" ? "outline" : "default"}
        onClick={toggle}
        disabled={!canToggle || busy}
        className="rounded-xl shrink-0"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : status === "admin-device" ? "ADM" : status === "enabled" ? "Desativar" : "Ativar"}
      </Button>
    </div>
  );
}
