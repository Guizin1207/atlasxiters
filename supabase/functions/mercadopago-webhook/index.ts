import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const paymentId = body?.data?.id || new URL(req.url).searchParams.get("data.id");
    if (!paymentId) return new Response("ok", { status: 200 });

    const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!token || !supabaseUrl || !serviceRole) throw new Error("Configuração do pagamento ausente");

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) throw new Error(payment?.message || "Não foi possível consultar o pagamento");

    const reference = JSON.parse(payment.external_reference || "{}");
    const key = String(reference.key || "").trim().toUpperCase();
    const plan = String(reference.plan || "");
    if (!key || !["basic", "pro", "master"].includes(plan)) return new Response("ok", { status: 200 });

    const supabase = createClient(supabaseUrl, serviceRole);
    const amount = Number(payment.transaction_amount);
    const expected = plan === "basic" ? 1 : plan === "pro" ? 85.99 : 149.99;
    const days = plan === "basic" ? 30 : plan === "pro" ? 90 : 0;

    if (payment.status === "approved" && Math.abs(amount - expected) < 0.01) {
      const { error } = await supabase
        .from("access_keys")
        .update({
          plan,
          is_master: plan === "master",
          duration_days: days,
          activated_at: new Date().toISOString(),
          expires_at: plan === "master" ? null : new Date(Date.now() + days * 86400000).toISOString(),
          revoked: false,
        })
        .eq("key", key);

      if (error) throw error;
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("ok", { status: 200 });
  }
});
