import { supabase } from "@/integrations/supabase/client";

export type RewardResponse = {
  ok: boolean;
  reason?: string;
  message?: string;
  coins?: number;
  daily_amount?: number;
  goal?: number;
  claimed_today?: boolean;
  last_claim?: string | null;
  total_claims?: number;
  current_streak?: number;
  best_streak?: number;
  claims?: { day: number; date: string; coins: number }[];
  reward_days?: number;
  expires_at?: string;
};

export async function rewardApi(
  action: "get" | "claim" | "redeem",
  key: string,
): Promise<{ data: RewardResponse | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke("atlas-rewards", {
    body: { action, key },
  });

  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: new Error("Resposta vazia do serviço de recompensa.") };
  return { data: data as RewardResponse, error: null };
}
