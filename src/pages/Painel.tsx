/**
 * Painel principal — protegido por chave.
 * Layout mobile-first com tabs Funções / Ajustes / Perfil.
 */
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { Gift, Flame, Coins, Plus, Clock3, X } from "lucide-react";
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
import { rewardApi } from "@/lib/reward-api";

export default function PainelPage() {
  const navigate = useNavigate();
  const { keyData, loading } = useKey();
  const maintenance = useMaintenance();
  const { expired } = useKeyValidity();
  const [tab, setTab] = useState<AtlasTab>("funcoes");
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [dailyReward, setDailyReward] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [supportOpen, setSupportOpen] = useState(
    () => new URLSearchParams(window.location.search).get("suporte") === "1"
  );

  useEffect(() => {
    if (!loading && keyData && !keyData.is_master) {
      void (async () => {
        const { data } = await rewardApi("get", keyData.key);
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
    const { data, error } = await rewardApi("claim", keyData.key);
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
        <PanelHeader onOpenRecentes={() => setDrawerOpen(true)} />
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

  const openNewChat = () => {
    setDrawerOpen(false);
    setSupportOpen(true);
  };

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

      {/* Gaveta lateral estilo ChatGPT: sempre existe uma alça visível para abrir. */}
      {!drawerOpen && (
        <button
          type="button"
          aria-label="Abrir Recentes"
          onClick={() => setDrawerOpen(true)}
          className="fixed left-0 top-1/2 z-[76] -translate-y-1/2 rounded-r-2xl border border-l-0 border-white/10 bg-background/95 px-2 py-4 shadow-2xl backdrop-blur-xl"
        >
          <span className="[writing-mode:vertical-rl] text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Recentes
          </span>
        </button>
      )}

      {/* Área de gesto estilo ChatGPT: puxe da borda esquerda para abrir. */}
      {!drawerOpen && (
        <div
          aria-hidden="true"
          className="fixed left-0 top-0 z-[75] h-full w-5 touch-pan-y"
          onTouchStart={(event) => {
            const touch = event.touches[0];
            if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
          }}
          onTouchEnd={(event) => {
            const start = touchStartRef.current;
            touchStartRef.current = null;
            const touch = event.changedTouches[0];
            if (!start || !touch) return;
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            if (dx >= 45 && Math.abs(dx) > Math.abs(dy) * 1.15) setDrawerOpen(true);
          }}
        />
      )}

      {drawerOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-[2px]"
          onTouchStart={(event) => {
            const touch = event.touches[0];
            if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
          }}
          onTouchEnd={(event) => {
            const start = touchStartRef.current;
            touchStartRef.current = null;
            const touch = event.changedTouches[0];
            if (!start || !touch) return;
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            if (dx <= -45 && Math.abs(dx) > Math.abs(dy) * 1.15) setDrawerOpen(false);
          }}
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            className="h-full w-[82%] max-w-sm border-r border-white/10 bg-background/95 p-5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="vip-eyebrow">Atlas</p>
                <h2 className="text-xl font-black">Recentes</h2>
              </div>
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={openNewChat}
              className="mt-6 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left text-black transition-transform active:scale-[0.98]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/10">
                <Plus className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-bold">Novo chat</span>
                <span className="block text-xs text-black/55">Abrir atendimento com o ADM</span>
              </span>
            </button>

            <div className="mt-7">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Conversas recentes
              </p>
              <button
                type="button"
                onClick={openNewChat}
                className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-left hover:bg-white/[0.06]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                  <Clock3 className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">Atendimento com o ADM</span>
                  <span className="block text-xs text-muted-foreground">Abrir conversa</span>
                </span>
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-xs leading-5 text-muted-foreground">
              Arraste da borda esquerda para a direita para abrir este menu.
            </div>
          </aside>
        </div>
      )}

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
