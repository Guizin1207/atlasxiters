/**
 * Página /admin — dashboard protegido.
 * Login de administrador separado do acesso de usuário por key.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Loader2, ShieldAlert, LogOut, LayoutGrid, UserRound, KeyRound,
  Smartphone, Coins, Bell, MessageSquare, LifeBuoy, Wrench, ShieldCheck,
  ArrowLeft,
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
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);

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
      <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-8 space-y-5">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl glass-strong flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="vip-eyebrow">Admin</p>
              <h1 className="vip-title text-lg leading-none">Atlas Control</h1>
              <p className="text-xs text-muted-foreground mt-1">
                {selected ? selected.title : "Central de administração"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => {
                if (adminPreview) closeAdminPanel();
                navigate("/login?trocar=1");
              }}
            >
              Acesso de usuário
            </Button>
            <Button
              onClick={async () => {
                if (!password || openingPanel) return;
                setOpeningPanel(true);
                const opened = await openAdminPanel(password);
                setOpeningPanel(false);
                if (opened) navigate("/painel");
              }}
              disabled={openingPanel}
              className="rounded-2xl"
            >
              {openingPanel ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LayoutGrid className="w-4 h-4 mr-2" />
              )}
              Abrir painel
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (adminPreview) closeAdminPanel();
                signOut();
              }}
              className="rounded-2xl glass hover:bg-white/10"
              aria-label="Sair do admin"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {!selectedFunction ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {adminFunctions.map(({ id, title, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedFunction(id)}
                className="glass-strong rounded-2xl p-4 text-left hover:bg-white/10 transition-colors"
              >
                <Icon className="w-5 h-5 mb-3" />
                <span className="font-semibold text-sm">{title}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              variant="ghost"
              className="rounded-2xl"
              onClick={() => setSelectedFunction(null)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>

            {selectedFunction === "overview" && <DeviceStatsCard />}

            {selectedFunction === "keys" && (
              <div className="space-y-6">
                <KeysListCard />
                <KeyGeneratorCard />
              </div>
            )}

            {selectedFunction === "devices" && <AdminDevicesCard />}

            {selectedFunction === "rewards" && (
              <section className="glass-strong rounded-3xl p-6">
                <p className="vip-eyebrow mb-1">Atlas Coins</p>
                <h2 className="text-xl font-bold">Recompensas</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  As funções de recompensa existentes continuam disponíveis.
                </p>
              </section>
            )}

            {selectedFunction === "notifications" && <PushNotificationsCard />}
            {selectedFunction === "messages" && <MessagesCard />}
            {selectedFunction === "support" && <SupportAdminCard />}
            {selectedFunction === "maintenance" && <MaintenanceCard />}

            {selectedFunction === "security" && (
              <section className="glass-strong rounded-3xl p-6">
                <p className="vip-eyebrow mb-1">Proteção</p>
                <h2 className="text-xl font-bold">Segurança do ADM</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Controle de acesso e sessões administrativas.
                </p>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
