/**
 * Página /admin — central administrativa protegida.
 * Navegação direta por funções, mantendo a ordem operacional do ADM.
 */
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Loader2,
  ShieldAlert,
  LogOut,
  LayoutGrid,
  KeyRound,
  Smartphone,
  Coins,
  Bell,
  MessageSquare,
  LifeBuoy,
  Wrench,
  ShieldCheck,
  BarChart3,
  Users,
  SlidersHorizontal,
  Info,
  Download,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/lib/admin-context";
import { useKey } from "@/lib/key-context";
import { DeviceStatsCard } from "@/components/admin/DeviceStatsCard";
import { AdminDevicesCard } from "@/components/admin/AdminDevicesCard";
import { MaintenanceCard } from "@/components/admin/MaintenanceCard";
import { KeyGeneratorCard } from "@/components/admin/KeyGeneratorCard";
import { KeysListCard } from "@/components/admin/KeysListCard";
import { MessagesCard } from "@/components/admin/MessagesCard";
import { SupportAdminCard } from "@/components/admin/SupportAdminCard";
import { PushNotificationsCard } from "@/components/admin/PushNotificationsCard";
import { AdminRewardsCard } from "@/components/admin/AdminRewardsCard";
import { SecurityCard } from "@/components/admin/SecurityCard";
import { FinanceAdminCard } from "@/components/admin/FinanceAdminCard";
import { getKeyStatus } from "@/lib/key-status";
import { syncPushServiceWorker } from "@/lib/push";
import { supabase } from "@/integrations/supabase/client";
import { AccountsCard } from "@/components/admin/AccountsCard";
import { PanelFunctionsCard } from "@/components/admin/PanelFunctionsCard";
import { AboutPanelAdminCard } from "@/components/admin/AboutPanelAdminCard";
import { DownloadFileAdminCard } from "@/components/admin/DownloadFileAdminCard";

type AdminFunction = {
  id: string;
  title: string;
  icon: React.ElementType;
};

const adminFunctions: AdminFunction[] = [
  { id: "overview", title: "Visão geral", icon: LayoutGrid },
  { id: "clients", title: "Clientes", icon: Users },
  { id: "functions", title: "Funções e IA", icon: SlidersHorizontal },
  { id: "finance", title: "Financeiro", icon: BarChart3 },
  { id: "keys", title: "Keys", icon: KeyRound },
  { id: "devices", title: "Dispositivos", icon: Smartphone },
  { id: "rewards", title: "Recompensas", icon: Coins },
  { id: "notifications", title: "Notificações", icon: Bell },
  { id: "messages", title: "Mensagens", icon: MessageSquare },
  { id: "support", title: "Suporte", icon: LifeBuoy },
  { id: "maintenance", title: "Manutenção", icon: Wrench },
  { id: "download", title: "Arquivo de download", icon: Download },
  { id: "about", title: "Sobre o painel", icon: Info },
  { id: "security", title: "Segurança", icon: ShieldCheck },
];

export default function AdminPage() {
  const { password, loading, signOut } = useAdmin();
  const { openAdminPanel, closeAdminPanel, adminPreview } = useKey();
  const navigate = useNavigate();
  const location = useLocation();
  const [openingPanel, setOpeningPanel] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab && adminFunctions.some((item) => item.id === tab) ? tab : "overview";
  });
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(false);
  const [overviewStats, setOverviewStats] = useState({ totalKeys: 0, activeKeys: 0, unusedKeys: 0, expiredKeys: 0, revokedKeys: 0, loading: true });
  const touchStartRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!password) return;
    let mounted = true;
    const loadOverview = async () => {
      const { data, error } = await supabase.rpc("admin_list_keys", { _password: password });
      if (!mounted || error) return;
      const keys = (data ?? []) as any[];
      const counts = keys.reduce((acc, key) => {
        const status = getKeyStatus(key);
        acc.totalKeys += 1;
        if (status === "active") acc.activeKeys += 1;
        if (status === "unused") acc.unusedKeys += 1;
        if (status === "expired") acc.expiredKeys += 1;
        if (status === "revoked") acc.revokedKeys += 1;
        return acc;
      }, { totalKeys: 0, activeKeys: 0, unusedKeys: 0, expiredKeys: 0, revokedKeys: 0 });
      setOverviewStats({ ...counts, loading: false });
    };
    void loadOverview();
    const timer = window.setInterval(loadOverview, 15000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [password]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedFunction === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", selectedFunction);
    if (selectedFunction !== "support") url.searchParams.delete("thread");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [selectedFunction]);

  useEffect(() => {
    void syncPushServiceWorker("admin").catch(() => {});
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "ATLAS_OPEN_URL" || typeof event.data.url !== "string") return;
      try {
        const target = new URL(event.data.url, window.location.origin);
        if (target.pathname !== "/admin") return;
        const tab = target.searchParams.get("tab");
        const threadId = target.searchParams.get("thread");
        if (tab && adminFunctions.some((item) => item.id === tab)) {
          setSelectedFunction(tab);
        }
        if (threadId) {
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent("atlas:open-support-thread", { detail: { threadId } }));
          }, 60);
        }
      } catch {
        // URL inválida ignorada
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!password) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/admin/login" state={{ from }} replace />;
  }

  const selected = adminFunctions.find((item) => item.id === selectedFunction);
  const adminGroups = [
    { title: "Controle", functions: adminFunctions.filter((item) => ["overview", "clients", "keys", "devices", "rewards", "finance", "security"].includes(item.id)) },
    { title: "Atendimento", functions: adminFunctions.filter((item) => ["notifications", "messages", "support"].includes(item.id)) },
    { title: "Sistema", functions: adminFunctions.filter((item) => ["maintenance", "functions", "download", "about"].includes(item.id)) },
  ];


  return (
    <main
      className="min-h-screen pb-16"
      onTouchStart={(event) => {
        const touch = event.touches[0];
        if (!touch) return;
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const touch = event.changedTouches[0];
        if (!touch) return;
        const start = touchStartRef.current;
        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;
        if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
        if (!adminDrawerOpen && start.x <= 80 && deltaX > 0) setAdminDrawerOpen(true);
        if (adminDrawerOpen && deltaX < 0) setAdminDrawerOpen(false);
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-5 sm:pt-7 space-y-5">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 shrink-0 rounded-xl border border-primary/40 bg-primary/15 text-primary shadow-lg shadow-primary/10 hover:bg-primary/25"
              onClick={() => setAdminDrawerOpen(true)}
              aria-label="Abrir funções ADM"
            >
              <span className="text-lg leading-none">☰</span>
            </Button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl glass-strong">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="vip-eyebrow">Admin</p>
              <h1 className="vip-title text-lg leading-none">Atlas Control</h1>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {selected?.title ?? "Central de administração"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              className="rounded-xl"
              onClick={async () => {
                if (!password || openingPanel) return;
                setOpeningPanel(true);
                const opened = await openAdminPanel(password);
                setOpeningPanel(false);
                if (opened) navigate("/painel");
              }}
              disabled={openingPanel}
            >
              {openingPanel ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <LayoutGrid className="mr-1.5 h-4 w-4" />
              )}
              <span className="hidden sm:inline">Painel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hidden rounded-xl sm:inline-flex"
              onClick={() => {
                if (adminPreview) closeAdminPanel();
                navigate("/login?trocar=1");
              }}
            >
              Acesso usuário
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (adminPreview) closeAdminPanel();
                signOut();
              }}
              className="h-9 w-9 rounded-xl glass hover:bg-white/10"
              aria-label="Sair do admin"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <nav className="hidden md:flex overflow-x-auto gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
          {adminFunctions.map((item) => {
            const Icon = item.icon;
            const active = selectedFunction === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedFunction(item.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-white text-black" : "text-muted-foreground hover:bg-white/10 hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </button>
            );
          })}
        </nav>

        <div className="md:hidden">
          <div
            aria-hidden="true"
            className="fixed inset-y-0 left-0 z-30 w-8"
          />

          {adminDrawerOpen && (
            <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setAdminDrawerOpen(false)}>
              <aside
                className="h-full w-[82%] max-w-sm overflow-y-auto border-r border-white/10 bg-background p-5 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="vip-eyebrow">Atlas</p>
                    <h2 className="text-2xl font-black">ADM</h2>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setAdminDrawerOpen(false)} aria-label="Fechar menu">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                {adminGroups.map((group) => (
                  <div key={group.title} className="mb-6">
                    <p className="mb-2 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.title}</p>
                    <div className="space-y-1">
                      {group.functions.map((item) => {
                        const Icon = item.icon;
                        const active = selectedFunction === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSelectedFunction(item.id);
                              setAdminDrawerOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left ${active ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5"}`}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="text-base font-medium">{item.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </aside>
            </div>
          )}
        </div>

                                                                        <section
          key={selectedFunction}
          aria-label={selected?.title ?? "Função administrativa"}
          className="animate-fade-in"
        >
          {selectedFunction === "overview" && (
            <div className="space-y-5">
              <div>
                <p className="vip-eyebrow">Atlas Control</p>
                <h2 className="text-2xl font-bold">Sobre o aplicativo</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                </p>
              </div>

              <section className="glass-strong rounded-3xl p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-xs text-muted-foreground">Versão atual</p>
                    <p className="mt-1 text-lg font-bold">1.0.0</p>
                    <p className="text-[11px] text-muted-foreground">versão do projeto</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-xs text-muted-foreground">Keys criadas</p>
                    <p className="mt-1 text-lg font-bold">{overviewStats.loading ? "—" : overviewStats.totalKeys}</p>
                    <p className="text-[11px] text-muted-foreground">total cadastrado</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-xs text-muted-foreground">Keys ativas</p>
                    <p className="mt-1 text-lg font-bold">{overviewStats.loading ? "—" : overviewStats.activeKeys}</p>
                    <p className="text-[11px] text-muted-foreground">em funcionamento</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-xs text-muted-foreground">Não utilizadas</p>
                    <p className="mt-1 text-lg font-bold">{overviewStats.loading ? "—" : overviewStats.unusedKeys}</p>
                    <p className="text-[11px] text-muted-foreground">disponíveis</p>
                  </div>
                </div>
              </section>

              <section className="glass-strong rounded-3xl p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="vip-eyebrow">Status</p>
                    <h3 className="font-bold">Estado atual do Atlas</h3>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Expiradas</p><p className="mt-1 text-xl font-bold">{overviewStats.loading ? "—" : overviewStats.expiredKeys}</p></div>
                  <div><p className="text-xs text-muted-foreground">Desativadas</p><p className="mt-1 text-xl font-bold">{overviewStats.loading ? "—" : overviewStats.revokedKeys}</p></div>
                  <div><p className="text-xs text-muted-foreground">Recursos ADM</p><p className="mt-1 text-xl font-bold">{adminFunctions.length}</p></div>
                  <div><p className="text-xs text-muted-foreground">Atualização</p><p className="mt-1 text-xl font-bold">15s</p></div>
                </div>
              </section>

              <section className="glass-strong rounded-3xl p-5 space-y-3">
                <div>
                  <p className="vip-eyebrow">Atalhos</p>
                  <h3 className="font-bold">Ações rápidas</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    { id: "keys", label: "Gerar Keys", icon: KeyRound },
                    { id: "support", label: "Suporte", icon: LifeBuoy },
                    { id: "maintenance", label: "Manutenção", icon: Wrench },
                    { id: "devices", label: "Dispositivos", icon: Smartphone },
                    { id: "notifications", label: "Notificações", icon: Bell },
                    { id: "clients", label: "Clientes", icon: Users },
                  ].map((shortcut) => {
                    const Icon = shortcut.icon;
                    return (
                      <Button
                        key={shortcut.id}
                        type="button"
                        variant="outline"
                        onClick={() => setSelectedFunction(shortcut.id)}
                        className="h-12 rounded-2xl justify-start gap-2 border-white/10 bg-white/[0.03] hover:bg-white/10"
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate text-xs font-semibold">{shortcut.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </section>

              <DeviceStatsCard />
            </div>
          )}

                    {selectedFunction === "clients" && <AccountsCard clients />}
          {selectedFunction === "functions" && <PanelFunctionsCard />}

          {selectedFunction === "finance" && (
            <div className="space-y-4">
              <div>
                <p className="vip-eyebrow">Gestão</p>
                <h2 className="text-xl font-bold">Financeiro</h2>
              </div>
              <FinanceAdminCard password={password} />
            </div>
          )}

          {selectedFunction === "keys" && (
            <div className="space-y-5">
              <div>
                <p className="vip-eyebrow">Gerenciamento</p>
                <h2 className="text-xl font-bold">Keys</h2>
              </div>
              <div className="space-y-6">
                <KeysListCard />
                <KeyGeneratorCard />
              </div>
            </div>
          )}

          {selectedFunction === "devices" && (
            <div className="space-y-4">
              <div>
                <p className="vip-eyebrow">Conexões</p>
                <h2 className="text-xl font-bold">Todos os dispositivos</h2>
              </div>
              <AdminDevicesCard />
            </div>
          )}

          {selectedFunction === "rewards" && (
            <div className="space-y-4">
              <div>
                <p className="vip-eyebrow">Atlas Coins</p>
                <h2 className="text-xl font-bold">Recompensas</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Controle completo de coins, check-ins, limites e resgates.
                </p>
              </div>
              <AdminRewardsCard />
            </div>
          )}

          {selectedFunction === "notifications" && (
            <div className="space-y-4">
              <div>
                <p className="vip-eyebrow">Comunicação</p>
                <h2 className="text-xl font-bold">Notificações</h2>
              </div>
              <PushNotificationsCard />
            </div>
          )}

          {selectedFunction === "messages" && (
            <div className="space-y-4">
              <div>
                <p className="vip-eyebrow">Comunicação</p>
                <h2 className="text-xl font-bold">Mensagens</h2>
              </div>
              <MessagesCard />
            </div>
          )}

          {selectedFunction === "support" && (
            <div className="space-y-4">
              <div>
                <p className="vip-eyebrow">Atendimento</p>
                <h2 className="text-xl font-bold">Suporte</h2>
              </div>
              <SupportAdminCard />
            </div>
          )}

          {selectedFunction === "maintenance" && (
            <div className="space-y-4">
              <div>
                <p className="vip-eyebrow">Sistema</p>
                <h2 className="text-xl font-bold">Manutenção</h2>
              </div>
              <MaintenanceCard />
            </div>
          )}

          {selectedFunction === "download" && (
            <div className="space-y-4">
              <div>
                <p className="vip-eyebrow">Sistema</p>
                <h2 className="text-xl font-bold">Arquivo de download</h2>
              </div>
              <DownloadFileAdminCard />
            </div>
          )}

          {selectedFunction === "about" && (
            <div className="space-y-4">
              <div>
                <p className="vip-eyebrow">Perfil do usuário</p>
                <h2 className="text-xl font-bold">Sobre o painel</h2>
              </div>
              <AboutPanelAdminCard />
            </div>
          )}

          {selectedFunction === "security" && <SecurityCard />}
        </section>
      </div>
    </main>
  );
}
