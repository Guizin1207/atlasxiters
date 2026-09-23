/**
 * Painel principal — protegido por chave.
 * Layout mobile-first com tabs Funções / Ajustes / Perfil.
 */
import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { Gift, Flame, Coins, Plus, MessageCircle, X, Loader2, Sparkles, Crosshair, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useKey } from "@/lib/key-context";
import { useMaintenance } from "@/hooks/use-maintenance";
import { useKeyValidity } from "@/hooks/use-key-validity";
import { usePanelSettings } from "@/hooks/use-panel-settings";
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
  const { settings: panelSettings } = usePanelSettings();
  const [tab, setTab] = useState<AtlasTab>("funcoes");
  const [sensiDevice, setSensiDevice] = useState("");
  const [sensiStyle, setSensiStyle] = useState("2 dedos");
  const [sensiDpi, setSensiDpi] = useState("Padrão");
  const [sensiMessages, setSensiMessages] = useState<{ role: "ai" | "user"; text: string }[]>([
    { role: "ai", text: "Fala! Eu sou a Atlas IA. Me conta qual é seu celular, quantos dedos você usa e se quer mais capa, precisão ou uma sensi rápida. Eu monto a configuração completa, incluindo o tamanho do botão de tiro." }
  ]);
  const [sensiInput, setSensiInput] = useState("");
  const [sensiTyping, setSensiTyping] = useState(false);
  const [sensiSeed, setSensiSeed] = useState(0);

  const getDeviceProfile = (deviceOverride?: string) => {
  const raw = (deviceOverride ?? sensiDevice).toLowerCase().trim();
  const model = raw
    .replace(/\b(apple|xiaomi|samsung|motorola|moto|galaxy|redmi|poco|realme|infinix|tecno)\b/g, "$1 ")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/\b(ip ?15|iphone ?15|15 pro|15 pro max|15\+|15 plus)\b/.test(model)) return { button: 57, offset: 2, label: "iPhone 15 / 15 Pro" };
  if (/\b(ip ?14|iphone ?14|14 pro|14 pro max|14\+|14 plus)\b/.test(model)) return { button: 57, offset: 2, label: "iPhone 14 / 14 Pro" };
  if (/\b(ip ?13|iphone ?13|13 pro|13 pro max|13 mini)\b/.test(model)) return { button: 58, offset: 2, label: "iPhone 13 / 13 Pro" };
  if (/\b(ip ?xr|iphone ?xr|xr)\b/.test(model)) return { button: 59, offset: 1, label: "iPhone XR" };
  if (/\b(ip ?xs|iphone ?xs|xs|xs max)\b/.test(model)) return { button: 59, offset: 1, label: "iPhone XS" };
  if (/\b(ip ?12|iphone ?12|12 pro|12 pro max|12 mini)\b/.test(model)) return { button: 59, offset: 1, label: "iPhone 12" };
  if (/\b(ip ?11|iphone ?11|11 pro|11 pro max)\b/.test(model)) return { button: 59, offset: 1, label: "iPhone 11" };
  if (model.includes("iphone")) return { button: 58, offset: 0, label: "iPhone" };
  if (/\b(s ?25|galaxy ?s ?25|a ?56)\b/.test(model)) return { button: 54, offset: 2, label: "Galaxy S25 / A56" };
  if (/\b(s ?24|galaxy ?s ?24|a ?55)\b/.test(model)) return { button: 54, offset: 2, label: "Galaxy S24 / A55" };
  if (/\b(s ?23|galaxy ?s ?23|a ?54)\b/.test(model)) return { button: 54, offset: 2, label: "Galaxy S23 / A54" };
  if (/\b(s ?22|galaxy ?s ?22|a ?53)\b/.test(model)) return { button: 55, offset: 1, label: "Galaxy S22 / A53" };
  if (/\b(s ?21|galaxy ?s ?21)\b/.test(model)) return { button: 55, offset: 1, label: "Galaxy S21" };
  if (/\b(s ?20|galaxy ?s ?20)\b/.test(model)) return { button: 55, offset: 1, label: "Galaxy S20" };
  if (model.includes("galaxy") || model.includes("samsung")) return { button: 56, offset: 0, label: "Samsung Galaxy" };
  if (/\b(note ?1[0-9]|redmi ?note|rn ?1[0-9]|poco ?[a-z0-9]+)\b/.test(model)) return { button: 53, offset: 1, label: "Redmi Note / POCO" };
  if (/\b(r ?[0-9]+|redmi ?[0-9]+|redmi)\b/.test(model)) return { button: 54, offset: 0, label: "Redmi" };
  if (/\b(moto ?g[0-9]+|g[0-9]+|moto ?e[0-9]+|edge ?[0-9]+|motorola)\b/.test(model)) return { button: 55, offset: -1, label: "Motorola / Moto" };
  if (model.includes("realme")) return { button: 54, offset: 0, label: "Realme" };
  if (model.includes("infinix") || model.includes("tecno")) return { button: 55, offset: 0, label: "Android" };
  return { button: 55, offset: 0, label: "Android" };
};

const getButtonSize = () => {
    const model = sensiDevice.toLowerCase();
    let size = model.includes("iphone") ? 58 : model.includes("redmi") || model.includes("poco") ? 53 : model.includes("samsung") || model.includes("galaxy") ? 55 : model.includes("motorola") || model.includes("moto") ? 54 : model.includes("realme") ? 53 : 55;
    if (sensiStyle === "3 dedos") size -= 2;
    if (sensiStyle === "4 dedos") size -= 3;
    if (sensiDpi === "Alto") size -= 1;
    if (sensiDpi === "Baixo") size += 1;
    return Math.max(48, Math.min(62, size));
  };

  const getSensiConfig = (deviceOverride?: string) => {
    const model = deviceOverride ?? sensiDevice;
    const profile = getDeviceProfile(model);
    const base = sensiStyle === "3 dedos" ? 98 : sensiStyle === "4 dedos" ? 92 : 95;
    const deviceAdjust = profile.offset;
    const dpiAdjust = sensiDpi === "Alto" ? 3 : sensiDpi === "Baixo" ? -3 : 0;
    const variation = sensiSeed % 3;
    return { geral: Math.min(200, base + deviceAdjust + dpiAdjust + variation), red: Math.min(200, base - 2 + deviceAdjust + dpiAdjust + variation), x2: Math.min(200, base - 8 + deviceAdjust + dpiAdjust), x4: Math.min(200, base - 14 + deviceAdjust + dpiAdjust), awm: Math.min(200, base - 22 + deviceAdjust), olhadinha: Math.min(200, base - 10 + variation), button: getButtonSize() };
  };

  const getFfTips = (message: string) => {
  const text = message.toLowerCase();
  const tips: string[] = [];
  const wantsGraphics = /(gr[aá]fico|grafico|qualidade|resolu[cç][aã]o|visual)/.test(text);
  const wantsPerformance = /(fps|travando|lag|lento|leve|pesado|desempenho|otim)/.test(text);
  const wantsSensi = /(dpi|touch|toque|sens[ií]|capa|headshot|bot[aã]o)/.test(text);
  if (wantsPerformance) {
    tips.push("⚡ DESEMPENHO");
    tips.push("• FPS: use o FPS mais alto que o aparelho mantém estável.");
    tips.push("• Gráficos: comece em Suave/Padrão para priorizar estabilidade.");
    tips.push("• Sombras e efeitos: reduza se houver queda de FPS.");
    tips.push("• Feche apps em segundo plano e evite jogar com o aparelho muito quente.");
  }
  if (wantsGraphics) {
    tips.push("🎮 GRÁFICOS");
    tips.push("• Qualidade baixa/Suave → mais estabilidade e resposta ao toque.");
    tips.push("• Qualidade alta → visual melhor, mas pode aumentar o uso de GPU.");
    tips.push("• Teste uma mudança por vez para saber o que realmente melhorou.");
  }
  if (wantsSensi) {
    tips.push("🎯 CONTROLE");
    tips.push("• DPI, sensibilidade e tamanho do botão devem ser ajustados juntos.");
    tips.push("• Se a mira passa da cabeça, reduza Geral/Ponto Vermelho aos poucos.");
    tips.push("• Se está pesada, aumente aos poucos em vez de mudar tudo de uma vez.");
    tips.push("• Botão de tiro: use o tamanho recomendado pelo perfil do aparelho e ajuste 1–2% por teste.");
  }
  if (/(config|configura[cç][aã]o|deixar|deixa|otim|melhorar|leve)/.test(text)) {
    tips.push("🛠️ CONFIGURAÇÃO LEVE");
    tips.push("• Priorize FPS estável em vez de qualidade gráfica máxima.");
    tips.push("• Mantenha o jogo e o sistema atualizados.");
    tips.push("• Evite sobreposição de muitos aplicativos durante a partida.");
  }
  return tips;
};

const sendSensiMessage = () => {
    const text = sensiInput.trim();
    if (!text || sensiTyping) return;
    const match = text.match(/(?:iphone|ip ?(?:\d+|xr|xs)|galaxy|samsung|s ?\d+|a ?\d+|redmi|rn ?\d+|note ?\d+|poco|motorola|moto ?[a-z]?\d+|g ?\d+|edge ?\d+|realme|infinix|tecno)[^,.!?]*/i);
    const nextDevice = sensiDevice || (match?.[0] ?? "");
    setSensiDevice(nextDevice);
    setSensiMessages((messages) => [...messages, { role: "user", text }]);
    setSensiInput("");
    setSensiTyping(true);
    window.setTimeout(() => {
      const cfg = getSensiConfig(nextDevice);
      const model = nextDevice || "seu aparelho";
      const ffTips = getFfTips(text);
      const detailedReply = [
        "🎯  CONFIGURAÇÃO ATLAS AI",
        "",
        "📱 APARELHO\n" + model,
      "🎯 PERFIL DE POSIÇÃO\n" + getDeviceProfile(nextDevice).label,
        "🎮 Estilo: " + sensiStyle,
        "⚙️ DPI: " + sensiDpi,
        "",
        "━━━━━━━━━━━━━━━━",
        "🔥  SENSIBILIDADE",
        "• Geral: " + cfg.geral,
        "• Ponto Vermelho: " + cfg.red,
        "• Mira 2x: " + cfg.x2,
        "• Mira 4x: " + cfg.x4,
        "• Mira AWM: " + cfg.awm,
        "• Olhadinha: " + cfg.olhadinha,
        "",
        "━━━━━━━━━━━━━━━━",
        "🔘  BOTÃO DE TIRO",
        "• Tamanho recomendado: " + cfg.button + "%",
        "• Comece com esse tamanho e ajuste de 1–2% se necessário.",
        "",
        "━━━━━━━━━━━━━━━━",
        "🧠  AJUSTE FINO",
        "• Mira passando da cabeça → diminua Geral e Ponto Vermelho em 2.",
        "• Mira pesada → aumente Geral e Ponto Vermelho em 2.",
        "• Dificuldade para puxar capa → teste +2 no botão de tiro.",
        "",
        "━━━━━━━━━━━━━━━━",
        "📌  OBSERVAÇÃO",
        "Essa configuração é uma base inicial. Ajuste aos poucos conforme tela, toque, FPS e seu estilo de jogo.",
      ...(ffTips.length ? ["", "━━━━━━━━━━━━━━━━", ...ffTips] : [])
      ].join("\n");
      setSensiMessages((messages) => [...messages, { role: "ai", text: detailedReply }]);
      setSensiSeed((value) => value + 1);
      setSensiTyping(false);
    }, 650);
  };

  const resetSensiChat = () => {
    setSensiMessages([{ role: "ai", text: "Beleza, vamos começar de novo. Qual é o seu celular e como você joga: 2, 3 ou 4 dedos? Também pode me dizer se prefere capa, precisão ou sensi rápida." }]);
    setSensiInput(""); setSensiDevice(""); setSensiSeed(0);
  };

  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [dailyReward, setDailyReward] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProgress, setDrawerProgress] = useState(0);
  const [draggingDrawer, setDraggingDrawer] = useState(false);
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; mode: "open" | "close" } | null>(null);
  const drawerProgressRef = useRef(0);
  const drawerDeltaRef = useRef(0);
  const sidebarWidthRef = useRef(1);
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
          {tab === "sensi" && (
            <section className="space-y-3">
              <div className="glass-strong overflow-hidden rounded-3xl">
                <div className="border-b border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10"><Sparkles className="h-5 w-5" /></div>
                      <div><p className="vip-eyebrow">Atlas AI</p><h2 className="text-lg font-black">IA de Sensi 2026</h2></div>
                    </div>
                    <button type="button" onClick={resetSensiChat} className="rounded-xl p-2 text-muted-foreground hover:bg-white/10" aria-label="Novo chat"><RotateCcw className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="min-h-[430px] space-y-3 p-3">
                  {sensiMessages.map((message, index) => (
                    <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                      <div className={message.role === "user" ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-6 text-primary-foreground" : "max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white/5 px-4 py-3 text-sm leading-6"}>{message.text}</div>
                    </div>
                  ))}
                  {sensiTyping && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md bg-white/5 px-4 py-3 text-xs text-muted-foreground">Atlas IA está pensando...</div></div>}
                </div>
                <div className="border-t border-white/10 bg-white/[0.02] p-3">
                  <div className="mb-2 flex gap-2 overflow-x-auto">
                    {["Meu celular é iPhone", "Uso 3 dedos", "Quero mais capa", "Quero precisão"].map((quick) => (
                      <button key={quick} type="button" onClick={() => setSensiInput(quick)} className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] hover:bg-white/10">{quick}</button>
                    ))}
                  </div>
                  <div className="flex items-end gap-2">
                    <textarea value={sensiInput} onChange={(e) => setSensiInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendSensiMessage(); } }} placeholder="Digite sua mensagem..." rows={1} className="min-h-11 flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 text-[16px] text-foreground outline-none focus:border-white/30" />
                    <Button onClick={sendSensiMessage} disabled={!sensiInput.trim() || sensiTyping} className="h-11 w-11 shrink-0 rounded-2xl p-0"><MessageCircle className="h-4 w-4" /></Button>
                  </div>
                  <p className="mt-2 text-center text-[10px] text-muted-foreground">Converse normalmente. A IA monta a base de sensibilidade e botão de tiro a partir do que você informar.</p>
                </div>
              </div>
            </section>
          )}

        </div>
      </div>

      {tab === "funcoes" && <InjectButton enabled={Object.values(panelSettings.functions ?? {}).some(Boolean)} />}

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
