import { supabase } from "@/integrations/supabase/client";

export type RewardResponse = {
  ok: boolean; reason?: string; message?: string; coins?: number; daily_amount?: number; goal?: number;
  claimed_today?: boolean; last_claim?: string | null; total_claims?: number; current_streak?: number;
  best_streak?: number; claims?: { day: number; date: string; coins: number }[];
  reward_days?: number; expires_at?: string;
};

const rpcName = (action: "get" | "claim" | "redeem") =>
  action === "get" ? "get_daily_reward" : action === "claim" ? "claim_daily_reward" : "redeem_atlas_coins";

async function rpcFallback(action: "get" | "claim" | "redeem", key: string) {
  const { data, error } = await supabase.rpc(rpcName(action), { _key: key });
  if (error) return { data: null as RewardResponse | null, error };
  const normalized = action === "redeem" && (data as any)?.reward ? (data as any).reward : data;
  return { data: normalized as RewardResponse, error: null };
}

export async function rewardApi(action: "get" | "claim" | "redeem", key: string): Promise<{ data: RewardResponse | null; error: Error | null }> {
  let edgeMessage = "";
  try {
    const { data, error } = await supabase.functions.invoke("atlas-rewards", { body: { action, key } });
    if (!error && data) {
      if ((data as RewardResponse).ok || (data as RewardResponse).reason !== "server_error") {
        return { data: data as RewardResponse, error: null };
      }
      edgeMessage = (data as RewardResponse).message || "Edge Function retornou server_error.";
    } else {
      const ctx = (error as any)?.context;
      edgeMessage = [error?.name, error?.message, ctx?.status ? `HTTP ${ctx.status}` : ""].filter(Boolean).join(": ");
    }
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
