import { useEffect } from "react";
import { Wrench, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKey } from "@/lib/key-context";

/**
 * Modal full-screen quando a manutenção está ativa.
 * Durante a atualização, qualquer ação/link de WhatsApp do app é ocultada.
 */
export function MaintenanceModal({ message }: { message: string }) {
  const { signOut } = useKey();

  useEffect(() => {
    const className = "atlas-maintenance-active";
    document.body.classList.add(className);

    const hideWhatsApp = () => {
      const elements = document.querySelectorAll<HTMLElement>(
        'a, button, [role="button"]'
      );

      elements.forEach((element) => {
        const href = element.getAttribute("href")?.toLowerCase() ?? "";
        const text = element.textContent?.toLowerCase() ?? "";

        if (
          href.includes("wa.me") ||
          href.includes("whatsapp") ||
          text.includes("whatsapp")
        ) {
          element.style.setProperty("display", "none", "important");
        }
      });
    };

    hideWhatsApp();

    const observer = new MutationObserver(hideWhatsApp);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.body.classList.remove(className);
    };
  }, []);

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
