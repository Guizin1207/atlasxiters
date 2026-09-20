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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");

    const { key, plan } = await req.json();
    const selected = PLANS[plan as keyof typeof PLANS];
    if (!selected || typeof key !== "string" || !key.trim()) {
      return new Response(JSON.stringify({ error: "Plano ou chave inválidos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = req.headers.get("origin") || "https://atlasxiters.lovable.app";
    const externalReference = JSON.stringify({ key: key.trim().toUpperCase(), plan });

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{
          id: `atlas-${plan}`,
          title: selected.name,
          quantity: 1,
          currency_id: "BRL",
          unit_price: selected.price,
        }],
        external_reference: externalReference,
        payment_methods: {
          excluded_payment_types: [],
          excluded_payment_methods: [],
          installments: 12,
          default_payment_method_id: null,
        },
        back_urls: {
          success: `${appUrl}/painel?pagamento=sucesso`,
          pending: `${appUrl}/painel?pagamento=pendente`,
          failure: `${appUrl}/painel?pagamento=erro`,
        },
        auto_return: "approved",
        payment_methods: {
          excluded_payment_types: [],
          excluded_payment_methods: [],
        },
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Mercado Pago recusou a criação do pagamento");
    }

    return new Response(JSON.stringify({ init_point: data.init_point, preference_id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao criar pagamento" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
