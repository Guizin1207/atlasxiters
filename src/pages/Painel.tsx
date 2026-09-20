/**
 * Painel principal — protegido por chave.
 * Layout mobile-first com tabs Funções / Ajustes / Perfil.
 */
import { useEffect, useState } from "react";
import { Gift, Flame, Coins } from "lucide-react";
import { toast } from "sonner";
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
import { RecompensaTab } from "@/components/atlas/RecompensaTab";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function PainelPage() {
  const navigate = useNavigate();
  const { keyData, loading } = useKey();
  const maintenance = useMaintenance();
  const { expired } = useKeyValidity();
  const [tab, setTab] = useState<AtlasTab>("funcoes");
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [dailyReward, setDailyReward] = useState<any>(null);
  const [supportOpen, setSupportOpen] = useState(
    () => new URLSearchParams(window.location.search).get("suporte") === "1"
  );

  useEffect(() => {
    if (!loading && keyData && !keyData.is_master) {
      void (async () => {
        const { data } = await (supabase as any).rpc("get_daily_reward", { _key: keyData.key });
        if (data?.ok && !data.claimed_today) {
          setDailyReward(data);
          setRewardOpen(true);
        }
      })();
    }
  }, [loading, keyData?.key, keyData?.is_master]);

  const collectDailyReward = async () => {
    if (!keyData?.key || rewardBusy) return;
    setRewardBusy(true);
    const { data, error } = await (supabase as any).rpc("claim_daily_reward", { _key: keyData.key });
    if (error || data?.ok === false) {
      if (data?.reason === "already_claimed") toast.info("Você já recebeu a recompensa de hoje.");
      else toast.error(String(error?.message ?? "Não foi possível receber a recompensa."));
    } else {
      toast.success("+10 Atlas Coins recebidos!");
      setDailyReward(data);
      setRewardOpen(false);
    }
    setRewardBusy(false);
  };

  useEffect(() => {
    if (!loading && !keyData && !expired) navigate(`/login${window.location.search}`, { replace: true });
  }, [keyData, loading, expired, navigate]);

  // Tela limitada: sino e suporte continuam acessíveis, funções pagas não são montadas.
  if (!loading && expired) {
    return (
      <main className="min-h-screen mx-auto max-w-md px-5 pt-6 pb-12">
        <PanelHeader />
        <ExpiredKeyModal />
      </main>
    );
  }

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
          {tab === "recompensa" && <RecompensaTab />}

        </div>
      </div>

      {tab === "funcoes" && <InjectButton />}

      {rewardOpen && dailyReward && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-background p-6 shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <Gift className="h-7 w-7" />
            </div>
            <div className="text-center">
              <p className="vip-eyebrow">Recompensa diária</p>
              <h2 className="mt-1 text-2xl font-black">Sua recompensa está pronta!</h2>
              <p className="mt-2 text-sm text-muted-foreground">Entre todos os dias e ganhe Atlas Coins.</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/5 p-3 text-center"><Coins className="mx-auto h-4 w-4" /><p className="mt-1 text-lg font-black">+10</p><p className="text-[10px] text-muted-foreground">Atlas Coins</p></div>
              <div className="rounded-2xl bg-white/5 p-3 text-center"><Flame className="mx-auto h-4 w-4" /><p className="mt-1 text-lg font-black">{dailyReward.current_streak ?? 0}</p><p className="text-[10px] text-muted-foreground">dias de sequência</p></div>
            </div>
            <Button onClick={collectDailyReward} disabled={rewardBusy} className="mt-5 h-11 w-full rounded-xl">{rewardBusy ? "Coletando..." : "Coletar recompensa"}</Button>
            <button type="button" onClick={() => setRewardOpen(false)} className="mt-3 w-full text-xs text-muted-foreground">Fechar</button>
          </div>
        </div>
      )}

      {supportOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 sm:items-center"
          onClick={() => setSupportOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="rounded-full bg-black/70 px-3 py-1 text-xs text-white"
              >
                Fechar
              </button>
            </div>
            <SupportChat />
          </div>
        </div>
      )}

      {blockMaintenance && (
        <MaintenanceModal message={maintenance.message} />
      )}
    </main>
  );
}
