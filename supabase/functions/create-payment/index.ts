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
    const token = Deno.env.get("ASAAS_API_KEY");
    if (!token) throw new Error("ASAAS_API_KEY não configurada");

    const { key, plan } = await req.json();
    const selected = PLANS[plan as keyof typeof PLANS];

    if (!selected || typeof key !== "string" || !key.trim()) {
      return new Response(JSON.stringify({ error: "Plano ou chave inválidos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = {
      access_token: token,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const customerResponse = await fetch("https://api.asaas.com/v3/customers", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Cliente Atlas VIP",
        externalReference: key.trim().toUpperCase(),
      }),
    });
    const customer = await customerResponse.json();
    if (!customerResponse.ok) {
      throw new Error(customer?.errors?.[0]?.description || "Asaas recusou o cliente");
    }

    const paymentResponse = await fetch("https://api.asaas.com/v3/payments", {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: customer.id,
        billingType: "PIX",
        value: selected.price,
        dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        description: selected.name,
        externalReference: `ATLAS|${key.trim().toUpperCase()}|${plan}`,
      }),
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) {
      throw new Error(payment?.errors?.[0]?.description || "Asaas recusou a cobrança");
    }

    const qrResponse = await fetch(`https://api.asaas.com/v3/payments/${payment.id}/pixQrCode`, {
      headers: { access_token: token, Accept: "application/json" },
    });
    const qr = await qrResponse.json();
    if (!qrResponse.ok) {
      throw new Error(qr?.errors?.[0]?.description || "Asaas não retornou o QR Code");
    }

    return new Response(JSON.stringify({
      payment_id: payment.id,
      encoded_image: qr.encodedImage,
      payload: qr.payload,
      expiration_date: qr.expirationDate,
      plan,
      price: selected.price,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Erro ao criar cobrança Pix",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
