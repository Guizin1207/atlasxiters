import { useEffect, useState } from "react";
import { Gift, Coins, Flame, CheckCircle2, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useKey } from "@/lib/key-context";
import { supabase } from "@/integrations/supabase/client";

type RewardState = {
  coins: number;
  last_daily_claim: string | null;
  total_claims: number;
  current_streak: number;
  best_streak: number;
  claimed_today: boolean;
};

export function RecompensaTab() {
  const { keyData } = useKey();
  const [reward, setReward] = useState<RewardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!keyData?.key || keyData.is_master) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_daily_reward", {
      _key: keyData.key,
    });
    if (!error && data) setReward(data as RewardState);
    else if (error) toast.error("Não foi possível carregar a recompensa");
    setLoading(false);
  };

  useEffect(() => { void load(); }, [keyData?.key, keyData?.is_master]);

  const claim = async () => {
    if (!keyData?.key || busy) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("claim_daily_reward", {
      _key: keyData.key,
    });
    if (error) {
      const msg = String(error.message ?? "");
      if (msg.includes("already_claimed")) toast.info("Você já recebeu a recompensa de hoje.");
      else toast.error("Não foi possível receber a recompensa.");
    } else {
      setReward(data as RewardState);
      toast.success("Você recebeu +10 Atlas Coins!");
    }
    setBusy(false);
  };

  const redeem = async () => {
    if (!keyData?.key || busy || (reward?.coins ?? 0) < 100) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("redeem_atlas_coins", {
      _key: keyData.key,
    });
    if (error) {
      toast.error("Não foi possível trocar as moedas.");
    } else {
      setReward((data?.reward ?? data) as RewardState);
      toast.success("+30 dias adicionados à sua chave!");
    }
    setBusy(false);
    void load();
  };

  if (!keyData || keyData.is_master) {
    return <section className="glass-strong rounded-2xl p-5"><p className="vip-eyebrow">Recompensa</p><p className="mt-2 text-sm text-muted-foreground">A recompensa diária está disponível para todos os planos ativos.</p></section>;
  }

  const coins = reward?.coins ?? 0;
  const progress = Math.min(coins, 100);

  return (
    <section aria-label="Recompensa" className="space-y-5">
      <div>
        <p className="vip-eyebrow mb-1">Benefícios Atlas</p>
        <h2 className="text-xl font-bold">Recompensa diária</h2>
      </div>

      <div className="glass-strong rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-3"><Gift className="w-5 h-5" /></div>
            <div><p className="font-bold">Atlas Coins</p><p className="text-xs text-muted-foreground">10 moedas por dia</p></div>
          </div>
          <div className="text-right"><p className="text-2xl font-black">{coins}</p><p className="text-[10px] text-muted-foreground">/ 100</p></div>
        </div>

        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Flame className="w-3.5 h-3.5" />Sequência</div><p className="mt-1 font-bold">{reward?.current_streak ?? 0} dias</p></div>
          <div className="rounded-xl bg-white/5 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Coins className="w-3.5 h-3.5" />Melhor sequência</div><p className="mt-1 font-bold">{reward?.best_streak ?? 0} dias</p></div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground"><Clock3 className="w-4 h-4 animate-pulse" />Carregando recompensa...</div>
        ) : (
          <Button onClick={claim} disabled={busy || reward?.claimed_today} className="w-full h-11 rounded-xl">
            {reward?.claimed_today ? <><CheckCircle2 className="w-4 h-4 mr-2" />Recompensa recebida hoje</> : <>Receber +10 Atlas Coins</>}
          </Button>
        )}

        <Button onClick={redeem} disabled={busy || coins < 100} variant="outline" className="w-full h-11 rounded-xl border-white/10">
          Trocar 100 Coins por +30 dias
        </Button>

        <p className="text-[11px] text-muted-foreground text-center">Ao atingir 100 Atlas Coins, você pode adicionar 30 dias à validade da sua chave.</p>
      </div>
    </section>
  );
}
