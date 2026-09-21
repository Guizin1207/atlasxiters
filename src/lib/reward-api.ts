import { supabase } from "@/integrations/supabase/client";

export type RewardResponse = {
  ok: boolean; reason?: string; message?: string; coins?: number; daily_amount?: number; goal?: number;
  claimed_today?: boolean; last_claim?: string | null; total_claims?: number; current_streak?: number;
  best_streak?: number; claims?: { day: number; date: string; coins: number }[];
  reward_days?: number; expires_at?: string;
};

const rpcName = (action: "get" | "claim" | "redeem") =>
  action === "get" ? "get_daily_reward" : action === "claim" ? "claim_daily_reward" : "redeem_atlas_coins";

async function directRpc(action: "get" | "claim" | "redeem", key: string): Promise<RewardResponse> {
  const normalizedKey = key.trim().toUpperCase();
  const { data, error } = await supabase.rpc(rpcName(action), { _key: normalizedKey });
  if (error) throw new Error(error.message || "Falha ao consultar recompensa.");
  const normalized = action === "redeem" && (data as any)?.reward ? (data as any).reward : data;
  if (!normalized) throw new Error("RPC retornou resposta vazia.");
  return normalized as RewardResponse;
}

export async function rewardApi(action: "get" | "claim" | "redeem", key: string): Promise<{ data: RewardResponse | null; error: Error | null }> {
  try {
    return { data: await directRpc(action, key), error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}