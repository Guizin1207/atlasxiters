import { supabase } from "@/integrations/supabase/client";

export type RewardResponse = {
  ok: boolean; reason?: string; message?: string; coins?: number; daily_amount?: number; goal?: number;
  claimed_today?: boolean; last_claim?: string | null; total_claims?: number; current_streak?: number;
  best_streak?: number; claims?: { day: number; date: string; coins: number }[];
  reward_days?: number; expires_at?: string;
};

const ATLAS_SUPABASE_URL = "https://abgrbidxhssmjqdeddpk.supabase.co";
const ATLAS_SUPABASE_KEY = "sb_publishable_g7ez7PF_3doMKk57vrbT7A_qWVOZ9b_";

const rpcName = (action: "get" | "claim" | "redeem") =>
  action === "get" ? "get_daily_reward" : action === "claim" ? "claim_daily_reward" : "redeem_atlas_coins";

async function directRpc(action: "get" | "claim" | "redeem", key: string): Promise<RewardResponse> {
  const response = await fetch(`${ATLAS_SUPABASE_URL}/rest/v1/rpc/${rpcName(action)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ATLAS_SUPABASE_KEY,
      Authorization: `Bearer ${ATLAS_SUPABASE_KEY}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({ _key: key }),
  });

  const raw = await response.text();
  let data: any = null;
  try { data = JSON.parse(raw); } catch {}

  if (!response.ok) {
    throw new Error(data?.message || data?.hint || data?.details || raw || `HTTP ${response.status}`);
  }

  const normalized = action === "redeem" && data?.reward ? data.reward : data;
  if (!normalized) throw new Error("RPC retornou resposta vazia.");
  return normalized as RewardResponse;
}

export async function rewardApi(action: "get" | "claim" | "redeem", key: string): Promise<{ data: RewardResponse | null; error: Error | null }> {
  try {
    const data = await directRpc(action, key);
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: null,
      error: new Error(`Serviço de recompensa indisponível: ${message}`),
    };
  }
}
