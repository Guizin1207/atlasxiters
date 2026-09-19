import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FunctionCard } from "./FunctionCard";
import { usePanelSettings } from "@/hooks/use-panel-settings";
import { useKey } from "@/lib/key-context";
import { ATLAS_FUNCTIONS, planAllows } from "@/lib/atlas-functions";
import { getPlan } from "@/lib/atlas-config";

/**
 * Aba "Funções" — estado persistido por chave e liberação por plano.
 */
export function FuncoesTab() {
  const { keyData } = useKey();
  const { settings, update, loading } = usePanelSettings();

  const plan = keyData?.is_master ? "master" : keyData?.plan ?? "basic";
  const active = settings.functions ?? {};

  const liberadas = ATLAS_FUNCTIONS.filter((f) => planAllows(plan, f.minPlan));

  if (loading) {
    return (
      <div className="glass-strong rounded-2xl h-40 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section aria-label="Funções disponíveis" className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="vip-eyebrow mb-1">Plano {getPlan(plan).name}</p>
          <h2 className="text-xl font-bold">Funções premium</h2>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {liberadas.length}/{ATLAS_FUNCTIONS.length} liberadas
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ATLAS_FUNCTIONS.map((f) => {
          const locked = !planAllows(plan, f.minPlan);
          return (
            <FunctionCard
              key={f.id}
              icon={f.icon}
              name={f.name}
              tag={f.tag}
              on={!!active[f.id]}
              locked={locked}
              lockLabel={getPlan(f.minPlan).name}
              onToggle={() => {
                if (locked) {
                  toast.error(`Disponível no plano ${getPlan(f.minPlan).name}`, {
                    description: "Faça upgrade na aba Perfil para liberar.",
                  });
                  return;
                }
                update({
                  functions: { ...active, [f.id]: !active[f.id] },
                });
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
