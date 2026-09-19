/**
 * Prévia de uma proposta da IA, com confirmação explícita do administrador.
 */
import { useState } from "react";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getPanelIcon } from "@/lib/atlas-functions";
import { getPlan } from "@/lib/atlas-config";
import { emitFunctionsChanged } from "@/hooks/use-panel-functions";

export type PanelProposal = {
  operation: "create" | "update" | "delete" | "reorder";
  id: string;
  name?: string | null;
  tag?: string | null;
  minPlan: string;
  icon: string;
  position: number;
  reason?: string;
};

const OP_LABEL: Record<PanelProposal["operation"], string> = {
  create: "Criar função",
  update: "Editar função",
  delete: "Remover função",
  reorder: "Mudar a ordem",
};

const ERROR_LABEL: Record<string, string> = {
  unauthorized: "Senha mestra inválida. Entre de novo no admin.",
  invalid_id: "Identificador da função inválido.",
  invalid_plan: "Plano inválido.",
  invalid_icon: "Ícone inválido.",
  invalid_content: "Nome ou categoria faltando.",
  not_found: "Essa função não existe mais no painel.",
};

export function PanelProposalCard({
  proposal,
  password,
}: {
  proposal: PanelProposal;
  password: string;
}) {
  const [state, setState] = useState<"pending" | "applied" | "rejected">("pending");
  const [saving, setSaving] = useState(false);
  const Icon = getPanelIcon(proposal.icon);
  const destructive = proposal.operation === "delete";

  const apply = async () => {
    setSaving(true);
    const { error } = await supabase.rpc("admin_apply_panel_proposal", {
      _password: password,
      _proposal: proposal as never,
    });
    setSaving(false);
    if (error) {
      const code = Object.keys(ERROR_LABEL).find((k) => error.message.includes(k));
      toast.error(code ? ERROR_LABEL[code] : "Não foi possível aplicar a alteração.");
      return;
    }
    setState("applied");
    emitFunctionsChanged();
    toast.success("Alteração aplicada no painel.");
  };

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="vip-eyebrow mb-1">{OP_LABEL[proposal.operation]}</p>
          <p className="font-bold text-sm leading-tight break-words">
            {proposal.name || proposal.id}
          </p>
          {proposal.reason && (
            <p className="text-xs text-muted-foreground mt-1">{proposal.reason}</p>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="glass-subtle rounded-xl px-3 py-2">
          <dt className="text-muted-foreground">Identificador</dt>
          <dd className="font-mono">{proposal.id}</dd>
        </div>
        <div className="glass-subtle rounded-xl px-3 py-2">
          <dt className="text-muted-foreground">Categoria</dt>
          <dd>{proposal.tag || "—"}</dd>
        </div>
        <div className="glass-subtle rounded-xl px-3 py-2">
          <dt className="text-muted-foreground">Plano mínimo</dt>
          <dd>{getPlan(proposal.minPlan).name}</dd>
        </div>
        <div className="glass-subtle rounded-xl px-3 py-2">
          <dt className="text-muted-foreground">Posição</dt>
          <dd>{proposal.position}</dd>
        </div>
      </dl>

      {destructive && state === "pending" && (
        <p className="flex items-start gap-2 text-[11px] text-status-danger">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
          Essa função deixa de aparecer para todos os usuários.
        </p>
      )}

      {state === "pending" ? (
        <div className="flex gap-2">
          <Button
            onClick={apply}
            disabled={saving}
            variant={destructive ? "destructive" : "default"}
            className="flex-1 rounded-xl"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Aplicar alteração
          </Button>
          <Button
            onClick={() => setState("rejected")}
            variant="ghost"
            disabled={saving}
            className="rounded-xl glass hover:bg-white/10"
          >
            <X className="w-4 h-4 mr-2" />
            Recusar
          </Button>
        </div>
      ) : (
        <p
          className={
            state === "applied"
              ? "text-[11px] text-status-active"
              : "text-[11px] text-muted-foreground"
          }
        >
          {state === "applied" ? "Alteração aplicada." : "Proposta recusada."}
        </p>
      )}
    </div>
  );
}
