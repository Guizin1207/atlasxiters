import { useState } from "react";
import {
  MoreVertical,
  Play,
  Plus,
  CalendarClock,
  Trash2,
  Ban,
  RotateCcw,
  Crown,
  Copy,
  Check,
  Undo2,
  Smartphone,
  Pencil,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import { useTicker } from "@/hooks/use-ticker";
import {
  formatCountdown,
  getDeviceIcon,
  msUntil,
} from "@/lib/atlas-utils";
import {
  getKeyStatus,
  STATUS_BADGE,
  STATUS_LABEL,
} from "@/lib/key-status";
import type { KeyData } from "@/lib/key-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type DialogKind = null | "extend" | "expiration" | "plan";

export function KeyRowItem({
  data,
  onChanged,
}: {
  data: KeyData;
  onChanged: () => void;
}) {
  const { password } = useAdmin();
  useTicker(1000); // contador ao vivo

  const [copied, setCopied] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [extendDays, setExtendDays] = useState(7);
  const [newExpiration, setNewExpiration] = useState<string>("");
  const [newPlan, setNewPlan] = useState<string>(data.plan ?? "basic");
  const [newDuration, setNewDuration] = useState<number>(data.duration_days || 30);
  const [newKey, setNewKey] = useState<string>(data.key);

  const status = getKeyStatus(data);
  const DeviceIcon = getDeviceIcon(data.device);

  const isDemo = data.plan === "demo";
  const remaining = data.is_master || isDemo ? Infinity : msUntil(data.expires_at);
  const warn = isFinite(remaining) && remaining > 0 && remaining < 86_400_000;
  const expired = isFinite(remaining) && remaining <= 0 && !!data.activated_at;

  const call = async (
    fn: string,
    args: Record<string, unknown>,
    successMsg: string
  ) => {
    if (!password) return;
    const { error } = await supabase.rpc(fn as never, {
      ...args,
      _password: password,
    } as never);
    if (error) {
      toast.error("Falha", { description: error.message });
      return false;
    }
    toast.success(successMsg);
    onChanged();
    return true;
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(data.key);
      setCopied(true);
      toast.success("Chave copiada");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] transition-colors">
      <div className="flex items-start gap-3">
        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Linha 1: chave + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={copyKey}
              className="font-mono text-sm font-semibold tracking-wider hover:text-foreground inline-flex items-center gap-1.5 group"
              aria-label="Copiar chave"
            >
              <span className="truncate">{data.key}</span>
              {copied ? (
                <Check className="w-3 h-3 text-status-active" />
              ) : (
                <Copy className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground" />
              )}
            </button>

            <span
              className={cn(
                "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border",
                STATUS_BADGE[status]
              )}
            >
              {STATUS_LABEL[status]}
            </span>

            {data.is_master && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-white text-black inline-flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Master
              </span>
            )}
          </div>

          {data.customer_name && (\n            <div className="text-sm font-semibold text-foreground">Cliente: {data.customer_name}</div>\n          )}\n\n          {/* Linha 2: dispositivo + duração + nota */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <DeviceIcon className="w-3.5 h-3.5" />
              {data.device ?? "Não registrado"}
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span>{data.is_master || isDemo ? "Ilimitada" : `${data.duration_days}d`}</span>
            {data.note && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span className="truncate max-w-[160px]">{data.note}</span>
              </>
            )}
          </div>

          {/* Linha 3: contador */}
          {data.activated_at && (
            <div
              className={cn(
                "font-mono text-xs tabular-nums",
                expired
                  ? "text-status-danger"
                  : warn
                  ? "text-status-warning"
                  : "text-status-active"
              )}
            >
              {formatCountdown(remaining)}
              {data.expires_at && !data.is_master && !isDemo && (
                <span className="text-muted-foreground/60 ml-2">
                  · até{" "}
                  {new Date(data.expires_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Menu de ações */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 rounded-lg hover:bg-white/10 shrink-0"
              aria-label="Ações da chave"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">Ações</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {!data.activated_at && !data.is_master && (
              <DropdownMenuItem
                onClick={() =>
                  call("admin_activate_key", { _id: data.id }, "Chave ativada")
                }
              >
                <Play className="w-4 h-4 mr-2" />
                Ativar manualmente
              </DropdownMenuItem>
            )}

            {!data.is_master && (
              <DropdownMenuItem
                onClick={() => {
                  setNewPlan(data.plan ?? "basic");
                  setNewDuration(data.plan === "master" ? 36500 : data.duration_days || 30);
                  setNewKey(data.key);
                  setDialog("plan");
                }}
              >
                <KeyRound className="w-4 h-4 mr-2" />
                Alterar plano / chave
              </DropdownMenuItem>
            )}

            {!data.is_master && (
              <DropdownMenuItem onClick={() => setDialog("extend")}>
                <Plus className="w-4 h-4 mr-2" />
                Estender dias
              </DropdownMenuItem>
            )}

            {!data.is_master && (
              <DropdownMenuItem
                onClick={() => {
                  setNewExpiration(
                    data.expires_at
                      ? new Date(data.expires_at).toISOString().slice(0, 16)
                      : new Date(Date.now() + 7 * 86_400_000)
                          .toISOString()
                          .slice(0, 16)
                  );
                  setDialog("expiration");
                }}
              >
                <CalendarClock className="w-4 h-4 mr-2" />
                Definir expiração…
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              onClick={() =>
                call(
                  "admin_reset_device",
                  { _id: data.id },
                  "Dispositivo resetado"
                )
              }
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Resetar dispositivo
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">
              Próximo acesso em
            </DropdownMenuLabel>
            <div className="grid grid-cols-2 gap-1 p-1">
              {(["Android", "iOS", "Windows", "Mac", "Linux"] as const).map((d) => (
                <DropdownMenuItem
                  key={d}
                  className="h-8 px-2 text-xs"
                  onClick={() =>
                    call(
                      "admin_set_device",
                      { _id: data.id, _device: d },
                      `Chave liberada para ${d}`
                    )
                  }
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1.5" />
                  {d}
                </DropdownMenuItem>
              ))}
            </div>

            <DropdownMenuSeparator />

            {data.revoked ? (
              <DropdownMenuItem
                onClick={() =>
                  call(
                    "admin_unrevoke_key",
                    { _id: data.id },
                    "Revogação desfeita"
                  )
                }
              >
                <Undo2 className="w-4 h-4 mr-2" />
                Desfazer revogação
              </DropdownMenuItem>
            ) : (
              !data.is_master && (
                <DropdownMenuItem
                  onClick={() =>
                    call("admin_revoke_key", { _id: data.id }, "Chave revogada")
                  }
                  className="text-status-danger focus:text-status-danger"
                >
                  <Ban className="w-4 h-4 mr-2" />
                  Revogar
                </DropdownMenuItem>
              )
            )}

            {!data.is_master && (
              <DropdownMenuItem
                onClick={() => setConfirmDelete(true)}
                className="text-status-danger focus:text-status-danger"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Apagar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!data.is_master && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setDialog("expiration")}
          className="mt-3 w-full rounded-xl border-status-danger/30 text-status-danger"
        >
          <CalendarClock className="mr-2 h-4 w-4" />
          Expirar key
        </Button>
      )}

      {/* Dialog: plano e chave */}
      <Dialog open={dialog === "plan"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Alterar plano e chave</DialogTitle>
            <DialogDescription>
              Escolha o plano, reinicie o prazo e, se quiser, troque a numeração da chave.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="vip-eyebrow block">Plano</label>
              <select
                value={newPlan}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewPlan(value);
                  if (value === "basic") setNewDuration(30);
                  if (value === "pro") setNewDuration(90);
                  if (value === "master") setNewDuration(36500);
                  if (value === "demo") setNewDuration(0);
                }}
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-3 text-sm"
              >
                <option value="demo">Demo</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="master">Master</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="vip-eyebrow block">Prazo em dias</label>
              <Input
                type="number"
                min={0}
                value={newDuration}
                disabled={newPlan === "master" || newPlan === "demo"}
                onChange={(e) => setNewDuration(Math.max(0, Number(e.target.value) || 0))}
                className="rounded-xl bg-white/5 border-white/10 h-11 disabled:opacity-60"
              />
              <p className="text-[11px] text-muted-foreground">Ao salvar, o prazo começa novamente a partir de agora.</p>
            </div>
            <div className="space-y-2">
              <label className="vip-eyebrow block">Nova chave</label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                placeholder="ATLS-XXXX-XXXX-XXXX"
                className="rounded-xl bg-white/5 border-white/10 h-11 font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button
              className="bg-white text-black hover:bg-white/90"
              onClick={async () => {
                const key = newKey.trim().toUpperCase();
                if (!key) {
                  toast.error("Informe uma chave");
                  return;
                }
                const ok = await call(
                  "admin_update_key_access",
                  { _id: data.id, _plan: newPlan, _duration_days: newDuration, _key: key },
                  "Plano, prazo e chave atualizados"
                );
                if (ok) setDialog(null);
              }}
            >
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: estender */}
      <Dialog open={dialog === "extend"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Estender chave</DialogTitle>
            <DialogDescription>
              Adicione dias ao tempo de expiração atual.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="vip-eyebrow block">Dias a adicionar</label>
            <Input
              type="number"
              min={1}
              value={extendDays}
              onChange={(e) =>
                setExtendDays(Math.max(1, Number(e.target.value) || 1))
              }
              className="rounded-xl bg-white/5 border-white/10 h-11"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-white text-black hover:bg-white/90"
              onClick={async () => {
                const ok = await call(
                  "admin_extend_key",
                  { _id: data.id, _days: extendDays },
                  `+${extendDays}d adicionados`
                );
                if (ok) setDialog(null);
              }}
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: definir expiração */}
      <Dialog
        open={dialog === "expiration"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Definir expiração</DialogTitle>
            <DialogDescription>
              Escolha a data e hora exatas em que a chave expira.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="vip-eyebrow block">Expira em</label>
            <Input
              type="datetime-local"
              value={newExpiration}
              onChange={(e) => setNewExpiration(e.target.value)}
              className="rounded-xl bg-white/5 border-white/10 h-11"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const ok = await call(
                  "admin_set_expiration",
                  { _id: data.id, _expires_at: null },
                  "Chave definida sem expiração"
                );
                if (ok) setDialog(null);
              }}
            >
              Sem expiração
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const ok = await call(
                  "admin_set_expiration",
                  { _id: data.id, _expires_at: new Date(Date.now() - 1000).toISOString() },
                  "Chave expirada agora"
                );
                if (ok) setDialog(null);
              }}
            >
              Expirar agora
            </Button>
            <Button
              className="bg-white text-black hover:bg-white/90"
              onClick={async () => {
                if (!newExpiration) return;
                const iso = new Date(newExpiration).toISOString();
                const ok = await call(
                  "admin_set_expiration",
                  { _id: data.id, _expires_at: iso },
                  "Expiração atualizada"
                );
                if (ok) setDialog(null);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm: apagar */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar esta chave?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A chave{" "}
              <span className="font-mono">{data.key}</span> será removida
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-status-danger hover:bg-status-danger/90 text-white"
              onClick={async () => {
                await call("admin_delete_key", { _id: data.id }, "Chave apagada");
                setConfirmDelete(false);
              }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
