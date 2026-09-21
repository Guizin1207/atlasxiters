/**
 * Painel principal — protegido por chave.
 * Layout mobile-first com tabs Funções / Ajustes / Perfil.
 */
import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { Gift, Flame, Coins, Plus, MessageCircle, X, Loader2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { isReceiptBody } from "@/lib/receipts";
import { enableUserPush, notifyRewardReady, notifyCoinsAdded } from "@/lib/push";

type SupportMessage = {
  id: string;
  thread_id: string;
  sender_type: string;
  body: string;
  created_at: string;
};

type RecentConversation = {
  id: string;
  title: string;
  subtitle: string;
};

function formatRecentTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function summarizeMessage(body: string) {
  if (isReceiptBody(body)) return "Comprovante enviado";
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return "Nova conversa";
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
}

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
  const [drawerProgress, setDrawerProgress] = useState(0);
  const [draggingDrawer, setDraggingDrawer] = useState(false);
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; mode: "open" | "close" } | null>(null);
  const [supportOpen, setSupportOpen] = useState(
    () => new URLSearchParams(window.location.search).get("suporte") === "1"
  );
  const [userPushReady, setUserPushReady] = useState(false);

  useEffect(() => {
    if (!loading && keyData && !keyData.is_master) {
      void (async () => {
        const { data } = await rewardApi("get", keyData.key);
        if (data?.ok) {
          setDailyReward(data);
          if (!data.claimed_today) setRewardOpen(true);
          const redeemCost = Number(data.goal ?? 0);
          const coins = Number(data.coins ?? 0);
          const balanceKey = `atlas_coins_seen:${keyData.key.toUpperCase()}`;
          const previousCoins = Number(localStorage.getItem(balanceKey) ?? "");
          if (Number.isFinite(previousCoins) && coins > previousCoins) {
            void notifyCoinsAdded(keyData.key, coins - previousCoins, coins);
          }
          localStorage.setItem(balanceKey, String(coins));
          if (redeemCost > 0 && coins >= redeemCost) {
            void notifyRewardReady(keyData.key, redeemCost);
          }
        }
      })();
    }
  }, [loading, keyData?.key, keyData?.is_master]);

  // Com a permissão já concedida, cadastra o aparelho automaticamente.
  useEffect(() => {
    if (loading || !keyData?.key || keyData.is_master || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    void enableUserPush(keyData.key)
      .then((status) => setUserPushReady(status === "enabled"))
      .catch(() => setUserPushReady(false));
  }, [loading, keyData?.key, keyData?.is_master]);

  const collectDailyReward = async () => {
    if (!keyData?.key || rewardBusy) return;
    setRewardBusy(true);
    // A permissão só é solicitada neste clique real do usuário.
    try {
      const status = await enableUserPush(keyData.key);
      setUserPushReady(status === "enabled");
      if (status === "ios-needs-install") {
        toast.info("No iPhone, adicione o Atlas à Tela de Início para ativar as notificações.");
      } else if (status === "denied") {
        toast.error("As notificações estão bloqueadas. Ative-as nos ajustes do navegador.");
      } else if (status === "unsupported") {
        toast.error("Este navegador não permite notificações push. Abra o Atlas no navegador compatível.");
      }
    } catch (error) {
      setUserPushReady(false);
      const message = error instanceof Error ? error.message : "Não foi possível cadastrar este aparelho para notificações.";
      toast.error(message);
    }
    const { data, error } = await rewardApi("claim", keyData.key);
    if (error || data?.ok === false) {
      if (data?.reason === "already_claimed") toast.info("Você já recebeu a recompensa de hoje.");
      else toast.error(String(error?.message ?? "Não foi possível receber a recompensa."));
    } else {
      toast.success("+10 Atlas Coins recebidos!");
      setDailyReward(data);
      setRewardOpen(false);
      const newCoins = Number(data?.coins ?? 0);
      const balanceKey = `atlas_coins_seen:${keyData.key.toUpperCase()}`;
      localStorage.setItem(balanceKey, String(newCoins));
      void notifyCoinsAdded(keyData.key, 10, newCoins);
      const redeemCost = Number(data?.goal ?? 0);
      const coins = Number(data?.coins ?? 0);
      if (redeemCost > 0 && coins >= redeemCost) {
        void notifyRewardReady(keyData.key, redeemCost);
      }
    }
    setRewardBusy(false);
  };

  useEffect(() => {
    if (!loading && !keyData && !expired) navigate(`/login${window.location.search}`, { replace: true });
  }, [keyData, loading, expired, navigate]);

  const loadRecentConversations = useCallback(async () => {
    if (!keyData?.key) {
      setRecentConversations([]);
      return;
    }

    setRecentLoading(true);
    const { data, error } = await supabase.rpc("support_list_messages", { _key: keyData.key });
    setRecentLoading(false);
    if (error) return;

    const messages = (data ?? []) as SupportMessage[];
    if (messages.length === 0) {
      setRecentConversations([]);
      return;
    }

    const last = messages[messages.length - 1];
    if (!last) return;
    setRecentConversations([
      {
        id: last.thread_id,
        title: summarizeMessage(last.body),
        subtitle: `${last.sender_type === "admin" ? "ADM" : "Você"} • ${formatRecentTime(last.created_at)}`,
      },
    ]);
  }, [keyData?.key]);

  useEffect(() => {
    if (drawerOpen) void loadRecentConversations();
  }, [drawerOpen, loadRecentConversations]);

  useEffect(() => {
    if (!supportOpen) void loadRecentConversations();
  }, [supportOpen, loadRecentConversations]);

  const setDrawerAmount = (value: number) => {
    const next = Math.max(0, Math.min(1, value));
    drawerProgressRef.current = next;
    setDrawerProgress(next);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerAmount(0);
    setDraggingDrawer(false);
    touchStartRef.current = null;
    drawerDeltaRef.current = 0;
  };

  const beginOpenGesture = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, mode: "open" };
    sidebarWidthRef.current = Math.max(window.innerWidth * 0.82, 1);
    setDraggingDrawer(true);
    setDrawerAmount(0);
    drawerDeltaRef.current = 0;
  };

  const beginCloseGesture = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, mode: "close" };
    sidebarWidthRef.current = Math.max(window.innerWidth * 0.82, 1);
    setDraggingDrawer(true);
    setDrawerAmount(1);
    drawerDeltaRef.current = 0;
  };

  const moveDrawerGesture = (event: TouchEvent<HTMLElement | HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    drawerDeltaRef.current = dx;
    if (Math.abs(dy) > Math.abs(dx) * 1.25) return;
    if (start.mode === "open") {
      setDrawerAmount(dx / sidebarWidthRef.current);
    } else {
      setDrawerAmount(1 + dx / sidebarWidthRef.current);
    }
  };

  const endDrawerGesture = () => {
    const start = touchStartRef.current;
    const dx = drawerDeltaRef.current;
    const shouldOpen = start?.mode === "open"
      ? drawerProgressRef.current >= 0.42 || dx >= 70
      : drawerProgressRef.current >= 0.42 && dx > -70;
    touchStartRef.current = null;
    drawerDeltaRef.current = 0;
    setDraggingDrawer(false);
    setDrawerOpen(shouldOpen);
    setDrawerAmount(shouldOpen ? 1 : 0);
  };

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

  const openNewChat = () => {
    closeDrawer();
    setSupportOpen(true);
  };

  return (
    <main className="min-h-screen pb-32 overflow-x-hidden">
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

      {!drawerOpen && (
        <div
          aria-hidden="true"
          className="fixed left-0 top-0 z-[75] h-full w-6 touch-pan-y"
          onTouchStart={beginOpenGesture}
          onTouchMove={moveDrawerGesture}
          onTouchEnd={endDrawerGesture}
          onTouchCancel={endDrawerGesture}
        />
      )}

      {(drawerOpen || drawerProgress > 0) && (
        <div
          className="fixed inset-0 z-[80] bg-background/75 backdrop-blur-[2px]"
          style={{ opacity: drawerProgress }}
          onClick={closeDrawer}
        >
          <aside
            className={`h-full w-[82%] max-w-sm border-r border-white/10 bg-background/95 p-4 shadow-2xl backdrop-blur-xl ${draggingDrawer ? "" : "transition-transform duration-300 ease-out"}`}
            style={{ transform: `translateX(${(drawerProgress - 1) * 100}%)` }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={beginCloseGesture}
            onTouchMove={moveDrawerGesture}
            onTouchEnd={endDrawerGesture}
            onTouchCancel={endDrawerGesture}
          >
            <div className="flex items-center justify-between pt-1">
              <h2 className="text-xl font-semibold">Recentes</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Fechar menu"
                onClick={closeDrawer}
                className="rounded-xl text-muted-foreground hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={openNewChat}
              className="mt-5 flex h-auto w-full justify-start gap-3 rounded-2xl bg-primary px-3.5 py-3.5 text-left text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background/10">
                <Plus className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">Novo chat</span>
                <span className="block truncate text-xs opacity-60">Iniciar suporte</span>
              </span>
            </Button>

            <div className="mt-7">
              {recentLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : recentConversations.length === 0 ? (
                <p className="px-1 py-6 text-sm text-muted-foreground">Nenhuma conversa recente</p>
              ) : (
                <div className="space-y-1">
                  {recentConversations.map((conversation) => (
                    <Button
                      key={conversation.id}
                      type="button"
                      variant="ghost"
                      onClick={openNewChat}
                      className="flex h-auto w-full justify-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/10"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{conversation.title}</span>
                        <span className="block text-xs text-muted-foreground">{conversation.subtitle}</span>
                      </span>
                    </Button>
                  ))}
                </div>
              )}
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
