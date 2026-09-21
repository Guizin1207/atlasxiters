/**
 * Página /admin — central administrativa protegida.
 * Navegação direta por funções, mantendo a ordem operacional do ADM.
 */
import { useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
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

type AdminFunction = {
  id: string;
  title: string;
  icon: React.ElementType;
};

const adminFunctions: AdminFunction[] = [
  { id: "overview", title: "Visão geral", icon: LayoutGrid },
  { id: "keys", title: "Keys", icon: KeyRound },
  { id: "devices", title: "Dispositivos", icon: Smartphone },
  { id: "rewards", title: "Recompensas", icon: Coins },
  { id: "notifications", title: "Notificações", icon: Bell },
  { id: "messages", title: "Mensagens", icon: MessageSquare },
  { id: "support", title: "Suporte", icon: LifeBuoy },
  { id: "maintenance", title: "Manutenção", icon: Wrench },
  { id: "security", title: "Segurança", icon: ShieldCheck },
];

export default function AdminPage() {
  const { password, loading, signOut } = useAdmin();
  const { openAdminPanel, closeAdminPanel, adminPreview } = useKey();
  const navigate = useNavigate();
  const [openingPanel, setOpeningPanel] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState("overview");
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0 });


  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!password) return <Navigate to="/admin/login" replace />;

  const selected = adminFunctions.find((item) => item.id === selectedFunction);
  const adminGroups = [
    { title: "Controle", functions: adminFunctions.filter((item) => ["overview", "keys", "devices", "rewards", "security"].includes(item.id)) },
    { title: "Atendimento", functions: adminFunctions.filter((item) => ["notifications", "messages", "support"].includes(item.id)) },
    { title: "Sistema", functions: adminFunctions.filter((item) => item.id === "maintenance") },
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
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-5 sm:pt-7 space-y-5">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
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
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 rounded-xl border border-primary/40 bg-primary/15 text-primary shadow-lg shadow-primary/10 hover:bg-primary/25"
              onClick={() => setAdminDrawerOpen(true)}
              aria-label="Abrir funções ADM"
            >
              <span className="text-lg leading-none">☰</span>
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
            <div className="space-y-4">
              <div>
                <p className="vip-eyebrow">Painel</p>
                <h2 className="text-xl font-bold">Visão geral</h2>
              </div>
              <DeviceStatsCard />
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
                <p className="vip-eyebrow">Acesso administrativo</p>
                <h2 className="text-xl font-bold">Dispositivos ADM</h2>
              </div>
              <AdminDevicesCard />
            </div>
          )}

          {selectedFunction === "rewards" && (
            <section className="glass-strong rounded-3xl p-6">
              <p className="vip-eyebrow mb-1">Atlas Coins</p>
              <h2 className="text-xl font-bold">Recompensas</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                As funções de recompensa existentes continuam disponíveis.
              </p>
            </section>
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

          {selectedFunction === "security" && (
            <section className="glass-strong rounded-3xl p-6">
              <p className="vip-eyebrow mb-1">Proteção</p>
              <h2 className="text-xl font-bold">Segurança do ADM</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Controle de acesso e sessões administrativas.
              </p>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
