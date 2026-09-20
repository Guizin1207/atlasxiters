/**
 * Painel principal — protegido por chave.
 * Layout mobile-first com tabs Funções / Ajustes / Perfil.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useKey } from "@/lib/key-context";
import { useMaintenance } from "@/hooks/use-maintenance";
import { useKeyValidity } from "@/hooks/use-key-validity";
import { PanelHeader } from "@/components/atlas/PanelHeader";
import { TabsNav, type AtlasTab } from "@/components/atlas/TabsNav";
import { FuncoesTab } from "@/components/atlas/FuncoesTab";
import { AjustesTab } from "@/components/atlas/AjustesTab";
import { PerfilTab } from "@/components/atlas/PerfilTab";
import { InjectButton } from "@/components/atlas/InjectButton";
import { MaintenanceModal } from "@/components/MaintenanceModal";
import { ExpiredKeyModal } from "@/components/ExpiredKeyModal";
import { SupportChat } from "@/components/atlas/SupportChat";
import { MessageCircle } from "lucide-react";

export default function PainelPage() {
  const navigate = useNavigate();
  const { keyData, loading } = useKey();
  const maintenance = useMaintenance();
  const { expired } = useKeyValidity();
  const [tab, setTab] = useState<AtlasTab>("funcoes");
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    if (!loading && !keyData) navigate("/login", { replace: true });
  }, [keyData, loading, navigate]);

  if (loading || !keyData) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="vip-eyebrow animate-pulse-soft">Carregando…</div>
      </main>
    );
  }

  const blockMaintenance = maintenance.enabled && !keyData.is_master;

  return (
    <main className="min-h-screen pb-32">
      <div className="mx-auto max-w-md px-3.5 pt-4 min-[390px]:px-5 min-[390px]:pt-6">
        <PanelHeader />

        <TabsNav value={tab} onChange={setTab} />

        <div className="mt-4 animate-fade-in min-[390px]:mt-6" key={tab}>
          {tab === "funcoes" && <FuncoesTab />}
          {tab === "ajustes" && <AjustesTab />}
          {tab === "perfil" && <PerfilTab />}

        </div>
      </div>

      {tab === "funcoes" && <InjectButton />}\n\n      <button\n        type="button"\n        onClick={() => setSupportOpen(true)}\n        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-2xl ring-1 ring-black/10 transition-transform hover:scale-105 active:scale-95"\n        aria-label="Abrir suporte"\n      >\n        <MessageCircle className="h-5 w-5" />\n      </button>\n\n      {supportOpen && (\n        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={() => setSupportOpen(false)}>\n          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>\n            <div className="mb-2 flex justify-end">\n              <button type="button" onClick={() => setSupportOpen(false)} className="rounded-full bg-black/70 px-3 py-1 text-xs text-white">Fechar</button>\n            </div>\n            <SupportChat />\n          </div>\n        </div>\n      )}

      {blockMaintenance && (
        <MaintenanceModal message={maintenance.message} />
      )}
      {expired && <ExpiredKeyModal />}
    </main>
  );
}
