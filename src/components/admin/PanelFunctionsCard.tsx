import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { useAdmin } from "@/lib/admin-context";
import { usePanelFunctions } from "@/hooks/use-panel-functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PanelProposalCard, type PanelProposal } from "./PanelProposalCard";
import { AdminAICard } from "./AdminAICard";

export function PanelFunctionsCard() {
  const { password } = useAdmin();
  const source = useMemo(() => password ? { password } : null, [password]);
  const { functions, loading, offline } = usePanelFunctions(source);
  const [draft, setDraft] = useState<PanelProposal | null>(null);
  const [proposal, setProposal] = useState<PanelProposal | null>(null);
  return <div className="space-y-6"><header className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Funções do painel</h2><Button size="sm" disabled={offline || loading} onClick={() => { setProposal(null); setDraft({ operation: "create", id: "", name: "", tag: "", minPlan: "basic", icon: "wand-2", position: 90 }); }}><Plus className="mr-2 h-4 w-4" />Nova função</Button></header>
    {offline ? <p role="alert" className="text-status-danger">Não foi possível carregar as funções. Tente novamente antes de alterar.</p> : loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <div className="divide-y divide-border">{functions.map(item => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{item.tag} · {item.minPlan} · posição {item.sortOrder}{!item.visible ? " · Oculta" : ""}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Editar ${item.name}`} onClick={() => { setProposal(null); setDraft({ operation: "update", id: item.id, name: item.name, tag: item.tag, minPlan: item.minPlan, icon: item.icon, position: item.sortOrder }); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" disabled={!item.visible} aria-label={`Remover ${item.name}`} onClick={() => { setDraft(null); setProposal({ operation: "delete", id: item.id, name: item.name, tag: item.tag, minPlan: item.minPlan, icon: item.icon, position: item.sortOrder }); }}><Trash2 className="h-4 w-4 text-status-danger" /></Button></div></div>)}</div>}
    {draft && <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); setProposal(draft); setDraft(null); }}><label className="space-y-1 text-xs">Identificador<Input required disabled={draft.operation !== "create"} pattern="[a-z0-9_-]{1,40}" value={draft.id} onChange={event => setDraft({ ...draft, id: event.target.value })} /></label><label className="space-y-1 text-xs">Nome<Input required maxLength={60} value={draft.name ?? ""} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label className="space-y-1 text-xs">Categoria<Input required maxLength={40} value={draft.tag ?? ""} onChange={event => setDraft({ ...draft, tag: event.target.value })} /></label><label className="space-y-1 text-xs">Posição<Input type="number" min={0} max={999} required value={draft.position} onChange={event => setDraft({ ...draft, position: Number(event.target.value) })} /></label><div className="space-y-1"><p className="text-xs">Plano mínimo</p><Select value={draft.minPlan} onValueChange={minPlan => setDraft({ ...draft, minPlan })}><SelectTrigger aria-label="Plano mínimo"><SelectValue /></SelectTrigger><SelectContent>{["basic", "pro", "master"].map(plan => <SelectItem key={plan} value={plan}>{plan}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end gap-2"><Button type="submit">Revisar alteração</Button><Button type="button" variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button></div></form>}
    {proposal && password && <PanelProposalCard key={JSON.stringify(proposal)} proposal={proposal} password={password} />}
    <AdminAICard />
  </div>;
}