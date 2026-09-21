/**
 * Página /admin — central administrativa protegida.
 * Navegação direta por funções, mantendo a ordem operacional do ADM.
 */
import { useState } from "react";
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

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!password) return <Navigate to="/admin/login" replace />;

  const selected = adminFunctions.find((item) => item.id === selectedFunction);

  return (
    <main className="min-h-screen pb-16">
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

                                                                        <nav aria-label="Funções administrativas" className="py-4">
          <div className="space-y-3">
            {[
              {
                title: "Controle",
                functions: [
                  { id: "overview", title: "Visão geral" },
                  { id: "keys", title: "Keys" },
                  { id: "devices", title: "Dispositivos" },
                  { id: "rewards", title: "Recompensas" },
                  { id: "security", title: "Segurança" },
                ],
              },
              {
                title: "Atendimento",
                functions: [
                  { id: "notifications", title: "Notificações" },
                  { id: "messages", title: "Mensagens" },
                  { id: "support", title: "Suporte" },
                ],
              },
              {
                title: "Sistema",
                functions: [{ id: "maintenance", title: "Manutenção" }],
              },
            ].map((group) => (
              <div key={group.title} className="flex min-h-14 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="flex w-12 shrink-0 items-center justify-center bg-white/[0.04]">
                  <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </span>
                </div>

                <div className="flex flex-1 flex-wrap items-center gap-2 p-3">
                  {group.functions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedFunction(item.id as AdminFunction["id"])}
                      className={[
                        "rounded-lg px-3 py-2 text-sm transition-colors",
                        selectedFunction === item.id
                          ? "bg-foreground text-background font-semibold"
                          : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                      ].join(" ")}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

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
