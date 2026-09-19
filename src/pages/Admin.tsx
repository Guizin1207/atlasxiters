/**
 * Página /admin — dashboard protegido.
 * Sem login próprio: sem senha mestra, redireciona para a tela de login única.
 */
import { Navigate } from "react-router-dom";
import { Loader2, ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/lib/admin-context";
import { DeviceStatsCard } from "@/components/admin/DeviceStatsCard";
import { MaintenanceCard } from "@/components/admin/MaintenanceCard";
import { KeyGeneratorCard } from "@/components/admin/KeyGeneratorCard";
import { KeysListCard } from "@/components/admin/KeysListCard";
import { MessagesCard } from "@/components/admin/MessagesCard";

export default function AdminPage() {
  const { password, loading, signOut } = useAdmin();

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!password) return <Navigate to="/login" replace />;

  return (
    <main className="min-h-screen pb-16">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-8 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl glass-strong flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <p className="vip-eyebrow">Admin</p>
              <h1 className="vip-title text-lg leading-none">Atlas Control</h1>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={signOut}
            className="rounded-2xl glass hover:bg-white/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </header>

        <DeviceStatsCard />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MaintenanceCard />
          <KeyGeneratorCard />
        </div>

        <KeysListCard />

        <MessagesCard />
      </div>
    </main>
  );
}
