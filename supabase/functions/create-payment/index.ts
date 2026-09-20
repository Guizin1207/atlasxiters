import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLANS = {
  basic: { name: "Atlas VIP Basic", price: 1, days: 30 },
  pro: { name: "Atlas VIP Pro", price: 85.99, days: 90 },
  master: { name: "Atlas VIP Master", price: 149.99, days: null },
} as const;

const PAYMENT_METHODS = [
  { type: "CREDIT_CARD" },
  { type: "DEBIT_CARD" },
  { type: "PIX" },
  { type: "BOLETO" },
  { type: "PAGBANK" },
  { type: "APPLE_PAY" },
  { type: "GOOGLE_PAY" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = Deno.env.get("PAGBANK_ACCESS_TOKEN");
    if (!token) throw new Error("PAGBANK_ACCESS_TOKEN não configurado");

    const { key, plan } = await req.json();
    const selected = PLANS[plan as keyof typeof PLANS];

    if (!selected || typeof key !== "string" || !key.trim()) {
      return new Response(JSON.stringify({ error: "Plano ou chave inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = req.headers.get("origin") || "https://atlasxiters.lovable.app";
    const referenceId = `ATLAS|${key.trim().toUpperCase()}|${plan}`;

    const response = await fetch("https://api.pagseguro.com/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reference_id: referenceId,
        items: [{
          reference_id: `atlas-${plan}`,
          name: selected.name,
          quantity: 1,
          unit_amount: Math.round(selected.price * 100),
        }],
        customer_modifiable: true,
        payment_methods: PAYMENT_METHODS,
        redirect_url: `${appUrl}/painel?pagamento=sucesso`,
        notification_urls: [`${Deno.env.get("SUPABASE_URL")}/functions/v1/pagbank-webhook`],
        payment_notification_urls: [`${Deno.env.get("SUPABASE_URL")}/functions/v1/pagbank-webhook`],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error_messages?.[0]?.description || data?.message || "PagBank recusou a criação do checkout");
    }

    const payLink = data?.links?.find((link: { rel?: string }) => link.rel === "PAY")?.href;

    if (!payLink) {
      throw new Error("PagBank não retornou o link de pagamento");
    }

    return new Response(JSON.stringify({
      init_point: payLink,
      checkout_id: data.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Erro ao criar pagamento",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
