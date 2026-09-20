import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:suporte@atlasxiters.lovable.app";

const CONTENT = {
  message: { title: "Atlas VIP — Novo atendimento", body: "Você recebeu uma nova mensagem no suporte." },
  receipt: { title: "Atlas VIP — Novo comprovante", body: "Um cliente enviou um comprovante." },
} as const;

type Kind = keyof typeof CONTENT;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return json({ error: "Notificações não configuradas." }, 500);
    }

    const raw = await req.json().catch(() => null);
    const kind = String(raw?.kind ?? "") as Kind;
    const key = typeof raw?.key === "string" ? raw.key.trim() : "";

    if (!CONTENT[kind]) return json({ error: "Tipo de notificação inválido." }, 400);
    if (!key) return json({ error: "Chave ausente." }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { data: validKey, error: keyError } = await admin.rpc("_valid_access_key", { _key: key });
    if (keyError) {
      console.error("Falha ao validar chave:", keyError.message);
      return json({ error: "Falha ao validar chave." }, 500);
    }
    if (validKey !== true) return json({ error: "Chave inválida." }, 403);

    const { data: subs, error: subsError } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");
    if (subsError) {
      console.error("Falha ao listar inscrições:", subsError.message);
      return json({ error: "Falha ao listar inscrições." }, 500);
    }
    if (!subs?.length) return json({ sent: 0, removed: 0, note: "Nenhum aparelho cadastrado." });

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const payload = JSON.stringify({ ...CONTENT[kind], url: "/admin", tag: `atlas-${kind}` });
    const stale: string[] = [];
    let sent = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        console.error(`Envio falhou [${status ?? "?"}]:`, (err as Error)?.message);
        if (status === 404 || status === 410) stale.push(sub.id);
      }
    }

    if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);

    return json({ sent, removed: stale.length });
  } catch (err) {
    console.error("notify-admin falhou:", (err as Error)?.message);
    return json({ error: (err as Error)?.message ?? "Erro inesperado." }, 500);
  }
});
