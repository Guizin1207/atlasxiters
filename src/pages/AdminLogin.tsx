import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdmin } from "@/lib/admin-context";

export default function AdminLoginPage() {
  const { password, loading, signIn } = useAdmin();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <main className="min-h-screen grid place-items-center"><Loader2 aria-label="Carregando login ADM" className="animate-spin" /></main>;
  if (password) return <Navigate to="/admin" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !value.trim()) return;
    setBusy(true); setError(null);
    try {
      if (await signIn(value.trim())) navigate("/admin", { replace: true });
      else setError("Senha de ADM inválida. Confira e tente novamente.");
    } catch {
      setError("Não foi possível validar o login. Confira sua conexão e tente novamente.");
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center space-y-3">
          <ShieldCheck className="w-12 h-12 mx-auto" />
          <p className="vip-eyebrow">Administrador</p>
          <h1 className="vip-title text-3xl">Acesso ADM</h1>
          <p className="text-sm text-muted-foreground">Entre com sua senha de administrador para gerenciar o painel e os aparelhos do ADM.</p>
        </header>
        <form onSubmit={submit} aria-label="Login de administrador" className="glass-strong rounded-3xl p-6 space-y-5">
          <label className="block space-y-3">
            <span className="vip-eyebrow">Senha do ADM</span>
            <Input type="password" autoComplete="current-password" autoCapitalize="none" spellCheck={false}
              value={value} onChange={(event) => { setValue(event.target.value); setError(null); }}
              disabled={busy} required className="h-14 rounded-2xl" />
          </label>
          {error && <p role="alert" className="rounded-xl bg-status-danger/10 p-3 text-sm text-status-danger">{error}</p>}
          <Button type="submit" disabled={busy || !value.trim()} className="w-full h-12 rounded-2xl">
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Entrar como ADM
          </Button>
        </form>
        <Link to="/login?trocar=1" className="block text-center text-sm underline underline-offset-4">Entrar como usuário com uma key</Link>
      </div>
    </main>
  );
}
