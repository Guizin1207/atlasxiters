import { useEffect, useState } from "react";
import { Gift, Coins, Flame, CheckCircle2, XCircle, Clock3, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useKey } from "@/lib/key-context";
import { rewardApi } from "@/lib/reward-api";

type RewardState = {
  coins: number;
  last_daily_claim: string | null;
  total_claims: number;
  current_streak: number;
  best_streak: number;
  claimed_today: boolean;
  today?: string;
  claims?: ClaimDay[];
};
type ClaimDay = { day: number; date: string; coins: number };
const week = ["D", "S", "T", "Q", "Q", "S", "S"];

export function RecompensaTab() {
  const { keyData } = useKey();
  const [reward, setReward] = useState<RewardState | null>(null);
  const [claims, setClaims] = useState<ClaimDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!keyData?.key || keyData.is_master) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Usa apenas um RPC público. O calendário vem junto com get_daily_reward,
    // evitando erro de schema cache/exposição de uma segunda função.
    const { data, error } = await rewardApi("get", keyData.key);

    if (error) {
      toast.error(String(error.message ?? "Não foi possível carregar a recompensa"));
      setLoading(false);
      return;
    }

    if (data?.ok === false) {
      toast.error(
        data.reason === "invalid_key"
          ? "Sua chave não está válida para receber a recompensa."
          : "Não foi possível carregar a recompensa."
      );
      setLoading(false);
      return;
    }

    setReward(data as unknown as RewardState);
    setClaims(Array.isArray(data?.claims) ? data.claims : []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [keyData?.key, keyData?.is_master]);

  const claim = async () => {
    if (!keyData?.key || busy || reward?.claimed_today) return;

    setBusy(true);
    const { data, error } = await rewardApi("claim", keyData.key);

    if (error || data?.ok === false) {
      const reason = data?.reason;
      if (reason === "already_claimed") {
        toast.info("Você já recebeu a recompensa de hoje.");
      } else if (reason === "invalid_key") {
        toast.error("Sua chave não está válida para receber a recompensa.");
      } else {
        toast.error(String(error?.message ?? "Não foi possível receber a recompensa."));
      }
    } else {
      toast.success("+10 Atlas Coins recebidos!");
    }

    await load();
    setBusy(false);
  };

  const redeem = async () => {
    if (!keyData?.key || busy || (reward?.coins ?? 0) < 100) return;

    setBusy(true);
    const { data, error } = await rewardApi("redeem", keyData.key);

    if (error || data?.ok === false) {
      toast.error(String(error?.message ?? "Não foi possível trocar as moedas."));
    } else {
      toast.success("+30 dias adicionados à sua chave!");
    }

    await load();
    setBusy(false);
  };

  if (!keyData || keyData.is_master) {
    return (
      <section className="glass-strong rounded-2xl p-5">
        <p className="vip-eyebrow">Recompensa</p>
        <p className="mt-2 text-sm text-muted-foreground">
          A recompensa diária está disponível para todos os planos ativos.
        </p>
      </section>
    );
  }

  const coins = reward?.coins ?? 0;
  const progress = Math.min(coins, 100);
  // As datas da recompensa são DATE (sem horário) no fuso de São Paulo.
  // Não use new Date("YYYY-MM-DD"), pois o JavaScript interpreta a string em UTC
  // e, à noite no Brasil, isso pode cair no dia anterior no calendário.
  const now = new Date();
  const serverToday = reward?.today ? String(reward.today).slice(0, 10) : "";
  const saoPauloDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const currentYear = serverToday ? Number(serverToday.slice(0, 4)) : Number(saoPauloDate.find((p) => p.type === "year")?.value);
  const currentMonth = serverToday ? Number(serverToday.slice(5, 7)) - 1 : Number(saoPauloDate.find((p) => p.type === "month")?.value) - 1;
  const currentDay = serverToday ? Number(serverToday.slice(8, 10)) : Number(saoPauloDate.find((p) => p.type === "day")?.value);
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const days = new Date(currentYear, currentMonth + 1, 0).getDate();
  const claimed = new Set(
    claims
      .filter((c) => {
        const date = String(c.date).slice(0, 10);
        const [year, month] = date.split("-").map(Number);
        return year === currentYear && month - 1 === currentMonth;
      })
      .map((c) => c.day)
  );
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <section aria-label="Recompensa" className="space-y-5">
      <div>
        <p className="vip-eyebrow mb-1">Benefícios Atlas</p>
        <h2 className="text-xl font-bold">Recompensa diária</h2>
      </div>

      <div className="glass-strong rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-3">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold">Atlas Coins</p>
              <p className="text-xs text-muted-foreground">10 moedas por dia</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black">{coins}</p>
            <p className="text-[10px] text-muted-foreground">/ 100</p>
          </div>
        </div>

        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Flame className="w-3.5 h-3.5" />Sequência
            </div>
            <p className="mt-1 font-bold">{reward?.current_streak ?? 0} dias</p>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Coins className="w-3.5 h-3.5" />Melhor sequência
            </div>
            <p className="mt-1 font-bold">{reward?.best_streak ?? 0} dias</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4" />
            <div>
              <p className="font-bold text-sm">Calendário de recompensas</p>
              <p className="text-[10px] text-muted-foreground capitalize">{monthLabel}</p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {week.map((d, i) => (
              <div key={i} className="text-center text-[10px] text-muted-foreground font-semibold">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} className="aspect-square" />
            ))}

            {Array.from({ length: days }, (_, i) => {
              const day = i + 1;
              const isClaimed = claimed.has(day);
              const isToday = day === currentDay;
              const isPastOrToday = day <= currentDay;

              return (
                <div
                  key={day}
                  title={
                    isClaimed
                      ? "+10 Atlas Coins"
                      : isPastOrToday
                        ? "Não coletado"
                        : "Disponível no dia " + day
                  }
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold border ${
                    isClaimed
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                      : isPastOrToday
                        ? "bg-red-500/10 text-red-400 border-red-500/30"
                        : "bg-white/5 text-muted-foreground border-white/10 opacity-50"
                  }${isToday ? " ring-1 ring-white/40" : ""}`}
                >
                  <span>{day}</span>
                  {isClaimed ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : isPastOrToday ? (
                    <XCircle className="w-3 h-3" />
                  ) : (
                    <span className="text-[9px]">•</span>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-[10px] text-muted-foreground">
            ✓ verde = coletado • ✕ vermelho = não coletado • dias futuros ficam bloqueados • no dia 1 o calendário passa para o novo mês.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
            <Clock3 className="w-4 h-4 animate-pulse" />Carregando recompensa...
          </div>
        ) : (
          <Button onClick={claim} disabled={busy || reward?.claimed_today} className="w-full h-11 rounded-xl">
            {reward?.claimed_today ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />Recompensa recebida hoje
              </>
            ) : (
              <>Receber +10 Atlas Coins</>
            )}
          </Button>
        )}

        <Button
          onClick={redeem}
          disabled={busy || coins < 100}
          variant="outline"
          className="w-full h-11 rounded-xl border-white/10"
        >
          Trocar 100 Coins por +30 dias
        </Button>

        <p className="text-[11px] text-muted-foreground text-center">
          Ao atingir 100 Atlas Coins, você pode adicionar 30 dias à validade da sua chave.
        </p>
      </div>
    </section>
  );
}