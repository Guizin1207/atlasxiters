import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type RewardResponse = {
  ok: boolean; reason?: string; message?: string; coins?: number; daily_amount?: number; goal?: number;
  claimed_today?: boolean; last_claim?: string | null; total_claims?: number; current_streak?: number;
  best_streak?: number; claims?: { day: number; date: string; coins: number }[];
  reward_days?: number; expires_at?: string;
};

const ATLAS_SUPABASE_URL = "https://abgrbidxhssmjqdeddpk.supabase.co";
const ATLAS_SUPABASE_KEY = "sb_publishable_g7ez7PF_3doMKk57vrbT7A_qWVOZ9b_";
const atlasClient = createClient(ATLAS_SUPABASE_URL, ATLAS_SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rpcName = (action: "get" | "claim" | "redeem") =>
  action === "get" ? "get_daily_reward" : action === "claim" ? "claim_daily_reward" : "redeem_atlas_coins";

async function rpcFallback(action: "get" | "claim" | "redeem", key: string) {
  const { data, error } = await atlasClient.rpc(rpcName(action), { _key: key });
  if (error) return { data: null as RewardResponse | null, error };
  const normalized = action === "redeem" && (data as any)?.reward ? (data as any).reward : data;
  return { data: normalized as RewardResponse, error: null };
}

async function edgeRequest(action: "get" | "claim" | "redeem", key: string) {
  const response = await fetch(`${ATLAS_SUPABASE_URL}/functions/v1/atlas-rewards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ATLAS_SUPABASE_KEY,
      Authorization: `Bearer ${ATLAS_SUPABASE_KEY}`,
    },
    body: JSON.stringify({ action, key }),
  });

  const text = await response.text();
  let data: RewardResponse | null = null;
  try { data = JSON.parse(text) as RewardResponse; } catch {}
  if (!response.ok) {
    throw new Error(data?.message || `HTTP ${response.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  }
  if (!data) throw new Error("Edge Function retornou uma resposta inválida.");
  return data;
}

export async function rewardApi(action: "get" | "claim" | "redeem", key: string): Promise<{ data: RewardResponse | null; error: Error | null }> {
  let edgeMessage = "";
  try {
    const data = await edgeRequest(action, key);
    if (data.ok || data.reason !== "server_error") return { data, error: null };
    edgeMessage = data.message || "Edge Function retornou server_error.";
  } catch (err) {
    edgeMessage = err instanceof Error ? err.message : String(err);
  }

  try {
    const rpc = await rpcFallback(action, key);
    if (!rpc.error && rpc.data) return { data: rpc.data, error: null };
    const rpcMessage = rpc.error?.message || "RPC sem resposta.";
    return { data: null, error: new Error(`Recompensa indisponível. Edge: ${edgeMessage || "falhou"} | RPC: ${rpcMessage}`) };
  } catch (err) {
    const rpcMessage = err instanceof Error ? err.message : String(err);
    return { data: null, error: new Error(`Recompensa indisponível. Edge: ${edgeMessage || "falhou"} | RPC: ${rpcMessage}`) };
  }
}
