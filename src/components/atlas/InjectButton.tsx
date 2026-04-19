import { Rocket } from "lucide-react";
import { toast } from "sonner";

/**
 * CTA flutuante. Apenas UI — mostra um toast de exemplo ao clicar.
 */
export function InjectButton() {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 px-5 w-full max-w-md">
      <button
        type="button"
        onClick={() =>
          toast.success("Pronto para injetar", {
            description: "Conecte as funções reais na próxima fase.",
          })
        }
        className="w-full h-16 rounded-2xl bg-white text-black font-bold uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 shadow-elevated active:scale-[0.98] transition-transform"
      >
        <Rocket className="w-4 h-4" />
        Injetar
      </button>
    </div>
  );
}
