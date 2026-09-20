import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    const referenceId = String(body?.reference_id || "");
    const charge = Array.isArray(body?.charges) ? body.charges[0] : body?.charge;
    const status = String(charge?.status || body?.status || "");

    if (!referenceId.startsWith("ATLAS|")) {
      return new Response("ok", { status: 200 });
    }

    const [, rawKey, plan] = referenceId.split("|");
    const key = String(rawKey || "").trim().toUpperCase();

    if (!key || !["basic", "pro", "master"].includes(plan)) {
      return new Response("ok", { status: 200 });
    }

    const expected = plan === "basic" ? 100 : plan === "pro" ? 8599 : 14999;
    const paid = Number(charge?.amount?.summary?.paid ?? charge?.amount?.value ?? 0);

    if (status !== "PAID" || paid !== expected) {
      return new Response("ok", { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) {
      throw new Error("Configuração do Supabase ausente");
    }

    const days = plan === "basic" ? 30 : plan === "pro" ? 90 : 0;
    const supabase = createClient(supabaseUrl, serviceRole);

    const { error } = await supabase
      .from("access_keys")
      .update({
        plan,
        is_master: plan === "master",
        duration_days: days,
        activated_at: new Date().toISOString(),
        expires_at: plan === "master"
          ? null
          : new Date(Date.now() + days * 86400000).toISOString(),
        revoked: false,
      })
      .eq("key", key);

    if (error) throw error;

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("ok", { status: 200 });
  }
});
