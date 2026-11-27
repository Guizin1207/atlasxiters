import { useEffect, useRef, useState } from "react";
import { Loader2, Palette, RotateCcw, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/lib/admin-context";
import { useAppearance } from "@/lib/appearance-context";
import { APP_THEMES, DEFAULT_APPEARANCE, prepareAppLogo } from "@/lib/app-appearance";
import { supabase } from "@/integrations/supabase/client";

export function AppearanceAdminCard() {
  const { password } = useAdmin();
  const { appearance, loading, error, refresh, apply } = useAppearance();
  const [draft, setDraft] = useState(appearance);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!dirty) setDraft(appearance); }, [appearance, dirty]);
  async function save() {
    if (!password || busy || loading || error) return;
    setBusy(true);
    try {
      const { error: failure } = await supabase.rpc("admin_save_app_appearance", { _password: password, _theme: draft.theme, _logo: draft.logo });
      if (failure) throw failure;
      apply(draft); setDirty(false); toast.success("Logo e tema atualizados.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar a aparência."); }
    finally { setBusy(false); }
  }
  return <section className="glass-strong rounded-3xl p-6 space-y-6">
    <header className="flex items-center gap-3"><Palette className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">Logo e temas</h2></header>
    {loading ? <Loader2 aria-label="Carregando aparência" className="h-5 w-5 animate-spin" /> : error ? <div role="alert" className="space-y-2"><p className="text-destructive">{error}</p><Button variant="outline" onClick={() => void refresh()}>Tentar novamente</Button></div> : <>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-border/20 bg-muted">{draft.logo ? <img alt="Prévia da logo" src={draft.logo} className="h-16 w-16 object-contain" /> : <Palette className="h-8 w-8 text-primary" />}</div>
        <div className="space-y-2"><h3 className="font-semibold">Logo do aplicativo</h3><p className="text-xs text-muted-foreground">PNG, JPG ou WebP · até 5 MB</p><div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4" />Enviar logo</Button>
          <Button variant="ghost" disabled={busy || !draft.logo} onClick={() => { setDraft({ ...draft, logo: "" }); setDirty(true); }}><RotateCcw className="mr-2 h-4 w-4" />Logo padrão</Button>
        </div></div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (event) => {
          const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
          setBusy(true); try { const logo = await prepareAppLogo(file); setDraft((value) => ({ ...value, logo })); setDirty(true); }
          catch (e) { toast.error(e instanceof Error ? e.message : "Imagem inválida."); } finally { setBusy(false); }
        }} />
      </div>
      <fieldset disabled={busy}><legend className="mb-3 font-semibold">Tema do painel</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{APP_THEMES.map((theme) => <Button key={theme.id} variant="outline" aria-pressed={draft.theme === theme.id} onClick={() => { setDraft({ ...draft, theme: theme.id }); setDirty(true); }} className={`holiday-choice h-auto min-h-20 flex-col gap-2 whitespace-normal rounded-lg ${draft.theme === theme.id ? "border-primary bg-primary/10" : ""}`} data-holiday={theme.id}><span aria-hidden className="text-2xl">{theme.symbol}</span><span className="text-sm text-center">{theme.name}</span><span className="holiday-swatch h-1 w-12 rounded-full" /></Button>)}</div></fieldset>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !dirty} onClick={() => void save()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar aparência</Button><Button variant="ghost" disabled={busy} onClick={() => { setDraft(DEFAULT_APPEARANCE); setDirty(true); }}><RotateCcw className="mr-2 h-4 w-4" />Restaurar padrão</Button></div>
    </>}
  </section>;
}