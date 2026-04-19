/**
 * Página /admin — login por senha mestra + dashboard.
 */
import { useState } from "react";
import { Loader2, Lock, ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdmin } from "@/lib/admin-context";
import { DeviceStatsCard } from "@/components/admin/DeviceStatsCard";
import { MaintenanceCard } from "@/components/admin/MaintenanceCard";
import { KeyGeneratorCard } from "@/components/admin/KeyGeneratorCard";
import { KeysListCard } from "@/components/admin/KeysListCard";
import { MessagesCard } from "@/components/admin/MessagesCard";

export default function AdminPage() {
  const { password, loading, signIn, signOut } = useAdmin();

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!password) return <AdminLogin onSubmit={signIn} />;

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

/* ---------- Login ---------- */
function AdminLogin({
  onSubmit,
}: {
  onSubmit: (pwd: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md animate-fade-in">
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl glass-strong mb-6">
            <Lock className="w-7 h-7" />
          </div>
          <p className="vip-eyebrow mb-2">Acesso restrito</p>
          <h1 className="vip-title text-3xl">Atlas Control</h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-xs mx-auto">
            Informe a senha mestra para entrar no painel administrativo.
          </p>
        </header>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setErr(null);
            const ok = await onSubmit(value);
            setBusy(false);
            if (!ok) setErr("Senha incorreta.");
          }}
          className="glass-strong rounded-3xl p-6 space-y-5"
        >
          <label className="block">
            <span className="vip-eyebrow block mb-3">Senha mestra</span>
            <Input
              type="password"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (err) setErr(null);
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={busy}
              className="h-14 rounded-2xl bg-white/5 border-white/10 focus-visible:ring-white/30 text-base"
              aria-invalid={!!err}
            />
          </label>

          {err && (
            <p
              role="alert"
              className="text-sm text-status-danger bg-status-danger/15 border border-status-danger/30 rounded-xl px-4 py-3"
            >
              {err}
            </p>
          )}

          <Button
            type="submit"
            disabled={busy || !value}
            className="w-full h-14 rounded-2xl text-base font-bold uppercase tracking-[0.15em] bg-white text-black hover:bg-white/90"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validando…
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}
