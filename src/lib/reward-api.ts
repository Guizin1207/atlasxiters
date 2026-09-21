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
  const url = supabase.supabaseUrl + "/rest/v1/rpc/" + rpcName(action);
  const normalizedKey = key.trim().toUpperCase();
  const sessionResult = await supabase.auth.getSession();
  const token = sessionResult.data.session?.access_token;
  const apiKey = (supabase as any).supabaseKey as string | undefined;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey ?? "",
      Authorization: "Bearer " + (token ?? apiKey ?? ""),
    },
    body: JSON.stringify({ _key: normalizedKey }),
  });
  const raw = await response.text();
  let data: any;
  try { data = JSON.parse(raw); } catch { data = null; }
  if (!response.ok) throw new Error(data?.message || data?.hint || data?.details || raw || ("HTTP " + response.status));
  if (!data) throw new Error("RPC retornou resposta vazia.");
  return (action === "redeem" && data.reward ? data.reward : data) as RewardResponse;
}

export async function rewardApi(action: "get" | "claim" | "redeem", key: string): Promise<{ data: RewardResponse | null; error: Error | null }> {
  try { return { data: await directRpc(action, key), error: null }; }
  catch (err) { return { data: null, error: err instanceof Error ? err : new Error(String(err)) }; }
}