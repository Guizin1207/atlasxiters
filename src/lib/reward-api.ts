import { supabase } from "@/integrations/supabase/client";

export type RewardResponse = {
  ok: boolean; reason?: string; message?: string; coins?: number; daily_amount?: number; goal?: number;
  claimed_today?: boolean; last_claim?: string | null; total_claims?: number; current_streak?: number;
  best_streak?: number; claims?: { day: number; date: string; coins: number }[];
  reward_days?: number; expires_at?: string;
};

export async function rewardApi(action: "get" | "claim" | "redeem", key: string): Promise<{ data: RewardResponse | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.functions.invoke("atlas-rewards", { body: { action, key } });
    if (error) {
      const ctx = (error as any).context;
      const detail = [error.name, error.message, ctx?.status ? `HTTP ${ctx.status}` : ""].filter(Boolean).join(": ");
      return { data: null, error: new Error(detail || "Falha ao acessar o serviço de recompensa.") };
    }
    if (!data) return { data: null, error: new Error("O serviço de recompensa não retornou dados.") };
    return { data: data as RewardResponse, error: null };
  } catch (err) {
    return { data: null, error: new Error(err instanceof Error ? err.message : "Falha inesperada ao solicitar a recompensa.") };
  }
}
