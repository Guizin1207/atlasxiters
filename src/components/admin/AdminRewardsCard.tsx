import { useCallback, useEffect, useState } from "react";
import { Coins, Flame, Loader2, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import { toast } from "sonner";

type RewardRow = {
  key_id: string; key: string; coins: number; last_daily_claim: string | null;
  total_claims: number; current_streak: number; best_streak: number;
  claimed_today: boolean; expires_at: string | null; revoked: boolean;
};
type Config = { daily_amount:number; max_coins:number; redeem_cost:number; redeem_days:number };

export function AdminRewardsCard() {
  const { password } = useAdmin();
  const [rows,setRows]=useState<RewardRow[]>([]);
  const [config,setConfig]=useState<Config>({daily_amount:10,max_coins:100,redeem_cost:100,redeem_days:30});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [amounts,setAmounts]=useState<Record<string,string>>({});

  const call=useCallback(async(name:string,args:Record<string,unknown>)=>{
    const {data,error}=await supabase.rpc(name as never,args as never);
    if(error) throw error;
    return data;
  },[]);

  const load=useCallback(async()=>{
    if(!password)return;
    setLoading(true);
    try{
      const [list,cfg]=await Promise.all([
        call("admin_reward_list",{_password:password}),
        call("admin_reward_config",{_password:password})
      ]);
      setRows((list??[]) as RewardRow[]);
      if(cfg)setConfig(cfg as Config);
    }catch(e){toast.error("Não foi possível carregar as recompensas.");}
    finally{setLoading(false);}
  },[password,call]);

  useEffect(()=>{void load();},[load]);

  const saveConfig=async()=>{
    if(!password)return; setSaving(true);
    try{
      const data=await call("admin_reward_set_config",{
        _password:password,
        _daily_amount:config.daily_amount,
        _max_coins:config.max_coins,
        _redeem_cost:config.redeem_cost,
        _redeem_days:config.redeem_days,
      });
      if(data)setConfig(data as Config);
      toast.success("Configuração de recompensas salva.");
      await load();
    }catch{toast.error("Erro ao salvar configuração.");}
    finally{setSaving(false);}
  };

  const addCoins=async(id:string)=>{
    const n=Number(amounts[id]??0); if(!password||!Number.isFinite(n)||n===0)return;
    try{await call("admin_reward_add_coins",{_key_id:id,_amount:n,_password:password});setAmounts(a=>({...a,[id]:""}));toast.success("Coins atualizados.");await load();}
    catch{toast.error("Não foi possível alterar os coins.");}
  };

  const setCoins=async(id:string,value:number)=>{
    if(!password)return;
    try{await call("admin_reward_set_coins",{_key_id:id,_coins:value,_password:password});toast.success("Saldo definido.");await load();}
    catch{toast.error("Não foi possível definir o saldo.");}
  };

  const reset=async(id:string,history:boolean)=>{
    if(!password)return;
    try{await call("admin_reward_reset",{_key_id:id,_clear_history:history,_password:password});toast.success(history?"Recompensa e histórico resetados.":"Recompensa resetada.");await load();}
    catch{toast.error("Não foi possível resetar.");}
  };

  return <section className="space-y-5">
    <div className="glass-strong rounded-3xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Settings2 className="w-5 h-5"/>
        <div><p className="vip-eyebrow">Configuração global</p><h2 className="text-xl font-bold">Regras da recompensa</h2></div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["daily_amount","Coins por check-in"],["max_coins","Máximo de coins"],["redeem_cost","Custo do resgate"],["redeem_days","Dias ganhos no resgate"]
        ].map(([key,label])=><label key={key} className="space-y-1.5"><span className="text-xs text-muted-foreground">{label}</span><Input type="number" min="1" value={config[key as keyof Config]} onChange={e=>setConfig(c=>({...c,[key]:Number(e.target.value)}))} className="rounded-xl"/></label>)}
      </div>
      <Button onClick={saveConfig} disabled={saving} className="rounded-xl">{saving&&<Loader2 className="w-4 h-4 mr-2 animate-spin"/>}Salvar regras</Button>
      <p className="text-xs text-muted-foreground">As regras novas valem para os próximos check-ins e resgates.</p>
    </div>

    <div className="glass-strong rounded-3xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3"><div><p className="vip-eyebrow">Controle por key</p><h2 className="text-xl font-bold">Atlas Coins e Check-in</h2></div><Button variant="outline" size="icon" onClick={()=>void load()} className="rounded-xl"><RefreshCw className="w-4 h-4"/></Button></div>
      {loading?<div className="h-32 grid place-items-center"><Loader2 className="animate-spin"/></div>:rows.length===0?<p className="text-sm text-muted-foreground py-8 text-center">Nenhuma key de usuário cadastrada.</p>:
      <div className="space-y-3">
        {rows.map(r=><div key={r.key_id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="font-bold text-sm break-all">{r.key}</p><p className="text-xs text-muted-foreground">{r.revoked?"Revogada":"Ativa"} · {r.claimed_today?"Check-in feito hoje":"Não coletou hoje"}</p></div>
            <div className="flex items-center gap-2"><Coins className="w-4 h-4"/><b>{r.coins}/{config.max_coins}</b><span className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="w-3 h-3"/> {r.current_streak}</span></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2">
            <Input type="number" placeholder="ex.: +50 ou -20" value={amounts[r.key_id]??""} onChange={e=>setAmounts(a=>({...a,[r.key_id]:e.target.value}))} className="rounded-xl"/>
            <Button onClick={()=>void addCoins(r.key_id)} className="rounded-xl"><Plus className="w-4 h-4 mr-1"/>Aplicar</Button>
            <Button variant="outline" onClick={()=>void setCoins(r.key_id,config.max_coins)} className="rounded-xl">Máximo</Button>
            <Button variant="outline" onClick={()=>void setCoins(r.key_id,0)} className="rounded-xl">Zerar</Button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Button variant="ghost" onClick={()=>void reset(r.key_id,false)} className="rounded-xl"><RefreshCw className="w-3 h-3 mr-1"/>Resetar check-in</Button>
            <Button variant="ghost" className="text-destructive rounded-xl" onClick={()=>void reset(r.key_id,true)}><Trash2 className="w-3 h-3 mr-1"/>Apagar histórico</Button>
          </div>
        </div>)}
      </div>}
    </div>
  </section>;
}
