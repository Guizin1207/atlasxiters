/**
 * Página /admin — dashboard protegido.
 * Login de administrador separado do acesso de usuário por key.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert, LogOut, LayoutGrid } from "lucide-react";
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

export default function AdminPage() {
  const { password, loading, signOut } = useAdmin();
  const { openAdminPanel, closeAdminPanel, adminPreview } = useKey();
  const navigate = useNavigate();
  const [openingPanel, setOpeningPanel] = useState(false);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!password) return <Navigate to="/admin/login" replace />;

  return (
    <main className="min-h-screen pb-16">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl glass-strong flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="vip-eyebrow">Admin</p>
              <h1 className="vip-title text-lg leading-none">Atlas Control</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => {
              if (adminPreview) closeAdminPanel();
              navigate("/login?trocar=1");
            }}>Acesso de usuário</Button>
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
              Abrir painel de funções
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

        <DeviceStatsCard />
        <AdminDevicesCard />


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MaintenanceCard />
          <KeyGeneratorCard />
        </div>


        <KeysListCard />

        <MessagesCard />

        <PushNotificationsCard />

        <SupportAdminCard />
      </div>
    </main>
  );
}
