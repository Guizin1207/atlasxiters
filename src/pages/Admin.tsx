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
  Menu,
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
    { title: "Controle", functions: [
      { id: "overview", title: "Visão geral", icon: LayoutGrid },
      { id: "keys", title: "Keys", icon: KeyRound },
      { id: "devices", title: "Dispositivos", icon: Smartphone },
      { id: "rewards", title: "Recompensas", icon: Coins },
      { id: "security", title: "Segurança", icon: ShieldCheck },
    ]},
    { title: "Atendimento", functions: [
      { id: "notifications", title: "Notificações", icon: Bell },
      { id: "messages", title: "Mensagens", icon: MessageSquare },
      { id: "support", title: "Suporte", icon: LifeBuoy },
    ]},
    { title: "Sistema", functions: [
      { id: "maintenance", title: "Manutenção", icon: Wrench },
    ]},
  ];

  useState(() => {
    let startX = 0;
    let startY = 0;
    const start = (e: TouchEvent) => { const t = e.touches[0]; if (t) { startX=t.clientX; startY=t.clientY; } };
    const end = (e: TouchEvent) => { const t=e.changedTouches[0]; if (!t) return; const dx=t.clientX-startX, dy=t.clientY-startY; if (Math.abs(dx)<55 || Math.abs(dx)<Math.abs(dy)*1.15) return; if (!adminDrawerOpen && startX<70 && dx>0) setAdminDrawerOpen(true); if (adminDrawerOpen && dx<0) setAdminDrawerOpen(false); };
    window.addEventListener("touchstart", start, {passive:true}); window.addEventListener("touchend", end, {passive:true});
    return () => { window.removeEventListener("touchstart", start); window.removeEventListener("touchend", end); };
  });



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

                                                                        <button
          type="button"
          aria-label="Abrir menu administrativo"
          onClick={() => setAdminDrawerOpen(true)}
          className="fixed left-0 top-1/2 z-40 -translate-y-1/2 rounded-r-2xl border border-l-0 border-white/10 bg-background/95 px-2 py-4 shadow-xl backdrop-blur-xl md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {adminDrawerOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setAdminDrawerOpen(false)}>
            <aside className="h-full w-[82%] max-w-sm overflow-y-auto border-r border-white/10 bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="vip-eyebrow">Atlas</p>
                  <h2 className="text-2xl font-black">Admin</h2>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setAdminDrawerOpen(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></Button>
              </div>
              {adminGroups.map((group) => (
                <div key={group.title} className="mb-6">
                  <p className="mb-2 px-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{group.title}</p>
                  <div className="space-y-1">
                    {group.functions.map((item) => {
                      const Icon = item.icon;
                      const active = selectedFunction === item.id;
                      return <button key={item.id} type="button" onClick={() => { setSelectedFunction(item.id); setAdminDrawerOpen(false); }} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors ${active ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5"}`}><Icon className="h-5 w-5 shrink-0" /><span className="text-base font-medium">{item.title}</span></button>;
                    })}
                  </div>
                </div>
              ))}
            </aside>
          </div>
        )}


