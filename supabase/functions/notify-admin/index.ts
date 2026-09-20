import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:suporte@atlasxiters.lovable.app";

type Audience = "admin" | "user";

const CONTENT: Record<
  string,
  { title: string; body: string; audience: Audience; url: string }
> = {
  // Disparadas pelo usuário → vão para os aparelhos do ADM
  message: {
    title: "Atlas VIP — Novo atendimento",
    body: "Você recebeu uma nova mensagem no suporte.",
    audience: "admin",
    url: "/admin",
  },
  receipt: {
    title: "Atlas VIP — Novo comprovante",
    body: "Um cliente enviou um comprovante.",
    audience: "admin",
    url: "/admin",
  },
  // Disparadas pelo ADM → vão para os aparelhos dos usuários
  reply: {
    title: "Atlas VIP — Suporte respondeu",
    body: "Você recebeu uma nova mensagem no chat de suporte.",
    audience: "user",
    url: "/painel",
  },
  notice: {
    title: "Atlas VIP — Novo aviso",
    body: "Você recebeu um novo aviso do administrador.",
    audience: "user",
    url: "/painel",
  },
  update: {
    title: "Atlas VIP — Atualização disponível",
    body: "O app foi atualizado. Abra para carregar a nova versão.",
    audience: "user",
    url: "/painel",
  },
  maintenance: {
    title: "Atlas VIP — Manutenção",
    body: "O app entrou em manutenção. Voltamos em instantes.",
    audience: "user",
    url: "/painel",
  },
  maintenance_end: {
    title: "Atlas VIP — Manutenção concluída",
    body: "Tudo normalizado. O painel já está liberado.",
    audience: "user",
    url: "/painel",
  },
  // Disparada pelo próprio usuário quando a chave dele expira → vai só para os aparelhos dele
  expired: {
    title: "Atlas VIP — Sua key foi expirada",
    body: "Sua key foi expirada. Fale com o suporte para renovar seu acesso.",
    audience: "user",
    url: "/painel?suporte=1",
  },
};

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
    const kind = String(raw?.kind ?? "");
    const key = typeof raw?.key === "string" ? raw.key.trim() : "";
    const password = typeof raw?.password === "string" ? raw.password : "";
    const targetKey = typeof raw?.targetKey === "string" ? raw.targetKey.trim() : "";
    const customBody = typeof raw?.body === "string" ? raw.body.trim().slice(0, 180) : "";

    const content = CONTENT[kind];
    if (!content) return json({ error: "Tipo de notificação inválido." }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    let query = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth");

    if (content.audience === "admin") {
      // Gatilho do usuário: exige uma chave de acesso válida.
      if (!key) return json({ error: "Chave ausente." }, 400);
      const { data: validKey, error: keyError } = await admin.rpc("_valid_access_key", { _key: key });
      if (keyError) {
        console.error("Falha ao validar chave:", keyError.message);
        return json({ error: "Falha ao validar chave." }, 500);
      }
      if (validKey !== true) return json({ error: "Chave inválida." }, 403);
      query = query.eq("scope", "admin");
    } else if (kind === "expired") {
      // Autoaviso de expiração: a chave já expirou (não passa em _valid_access_key),
      // então basta localizar a chave e limitar o envio aos aparelhos dela.
      if (!key) return json({ error: "Chave ausente." }, 400);
      const { data: keyRow } = await admin
        .from("access_keys")
        .select("id")
        .eq("key", key.toUpperCase())
        .maybeSingle();
      if (!keyRow?.id) return json({ sent: 0, removed: 0, note: "Chave não encontrada." });
      query = query.eq("scope", "user").eq("key_id", keyRow.id);
    } else {
      // Envio para usuários: só o ADM autenticado pode disparar.
      if (!password) return json({ error: "Senha ausente." }, 400);
      const { data: isAdmin, error: adminError } = await admin.rpc("_check_admin", { _password: password });
      if (adminError) {
        console.error("Falha ao validar senha:", adminError.message);
        return json({ error: "Falha ao validar senha." }, 500);
      }
      if (isAdmin !== true) return json({ error: "Senha inválida." }, 403);

      query = query.eq("scope", "user");

      if (targetKey) {
        const { data: keyRow } = await admin
          .from("access_keys")
          .select("id")
          .eq("key", targetKey.toUpperCase())
          .maybeSingle();
        if (!keyRow?.id) return json({ sent: 0, removed: 0, note: "Chave de destino não encontrada." });
        query = query.eq("key_id", keyRow.id);
      }
    }

    const { data: subs, error: subsError } = await query;
    if (subsError) {
      console.error("Falha ao listar inscrições:", subsError.message);
      return json({ error: "Falha ao listar inscrições." }, 500);
    }
    if (!subs?.length) return json({ sent: 0, removed: 0, note: "Nenhum aparelho cadastrado." });

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const payload = JSON.stringify({
      title: content.title,
      body: customBody || content.body,
      url: content.url,
      tag: `atlas-${kind}`,
    });
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
