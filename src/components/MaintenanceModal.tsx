import { Wrench, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKey } from "@/lib/key-context";

/**
 * Modal full-screen quando a manutenção está ativa.
 * Não pode ser fechado — apenas sair ou contatar suporte.
 */
export function MaintenanceModal({ message }: { message: string }) {
  const { signOut } = useKey();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="maint-title"
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center px-6 animate-fade-in"
    >
      <div className="glass-strong rounded-3xl p-8 max-w-md w-full text-center space-y-5">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-status-warning/15 items-center justify-center mx-auto">
          <Wrench className="w-7 h-7 text-status-warning" />
        </div>
        <div>
          <p className="vip-eyebrow mb-2">Sistema</p>
          <h2 id="maint-title" className="vip-title text-2xl">
            Em manutenção
          </h2>
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {message || "Voltamos em instantes."}
        </p>

        <Button
          variant="ghost"
          onClick={signOut}
          className="w-full h-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
}
