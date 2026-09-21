import { supabase } from "@/integrations/supabase/client";

export type RewardResponse = {
  ok: boolean; reason?: string; message?: string; coins?: number; daily_amount?: number; goal?: number;
  claimed_today?: boolean; last_claim?: string | null; last_daily_claim?: string | null;
  total_claims?: number; current_streak?: number; best_streak?: number;
  claims?: { day: number; date: string; coins: number }[];
  reward_days?: number; expires_at?: string; reward?: RewardResponse;
};

const rpcName = (action: "get" | "claim" | "redeem") =>
  action === "get" ? "get_daily_reward" : action === "claim" ? "claim_daily_reward" : "redeem_atlas_coins";

export async function rewardApi(
  action: "get" | "claim" | "redeem",
  key: string,
): Promise<{ data: RewardResponse | null; error: Error | null }> {
  const { data, error } = await supabase.rpc(rpcName(action) as never, {
    _key: key.trim().toUpperCase(),
  } as never);
  if (error) return { data: null, error: new Error(error.message) };
  const payload = data as unknown as RewardResponse | null;
  if (action === "redeem" && payload?.reward) return { data: payload.reward, error: null };
  return { data: payload, error: null };
}
