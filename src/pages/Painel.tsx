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
import { PlanosTab } from "@/components/atlas/PlanosTab";
import { InjectButton } from "@/components/atlas/InjectButton";
import { MaintenanceModal } from "@/components/MaintenanceModal";
import { ExpiredKeyModal } from "@/components/ExpiredKeyModal";

export default function PainelPage() {
  const navigate = useNavigate();
  const { keyData, loading } = useKey();
  const maintenance = useMaintenance();
  const { expired } = useKeyValidity();
  const [tab, setTab] = useState<AtlasTab>("funcoes");

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
      <div className="max-w-md mx-auto px-5 pt-6">
        <PanelHeader />

        <TabsNav value={tab} onChange={setTab} />

        <div className="mt-6 animate-fade-in" key={tab}>
          {tab === "funcoes" && <FuncoesTab />}
          {tab === "planos" && <PlanosTab />}
          {tab === "ajustes" && <AjustesTab />}
          {tab === "perfil" && <PerfilTab />}
        </div>
      </div>

      {tab === "funcoes" && <InjectButton />}

      {blockMaintenance && (
        <MaintenanceModal message={maintenance.message} />
      )}
      {expired && <ExpiredKeyModal />}
    </main>
  );
}
