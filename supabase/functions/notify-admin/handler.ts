import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };
type Dependencies = {
  admin: SupabaseClient;
  pushConfigured: boolean;
  corsHeaders: Record<string, string>;
  sendNotification: (target: PushTarget, payload: string) => Promise<unknown>;
};

type Audience = "admin" | "user";

const CONTENT: Record<
  string,
  { title: string; body: string; audience: Audience; url: string }
> = {
  admin_test: {
    title: "Atlas VIP — Teste do ADM chefe",
    body: "Este aparelho está vinculado aos avisos de mensagens e comprovantes do suporte.",
    audience: "admin",
    url: "/admin",
  },
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

export function createNotifyHandler({ admin, pushConfigured, corsHeaders, sendNotification }: Dependencies) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const json = (payload: unknown, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    try {
      if (!pushConfigured) {
        return json({ error: "Notificações não configuradas." }, 500);
      }

      const raw = await req.json().catch(() => null);
      const kind = String(raw?.kind ?? "");
      const key = typeof raw?.key === "string" ? raw.key.trim() : "";
      const password = typeof raw?.password === "string" ? raw.password : "";
      const targetKey = typeof raw?.targetKey === "string" ? raw.targetKey.trim() : "";
      const targetEndpoint = typeof raw?.targetEndpoint === "string" ? raw.targetEndpoint.trim() : "";
      const messageId = typeof raw?.messageId === "string" ? raw.messageId : "";
      const customBody = typeof raw?.body === "string" ? raw.body.trim().slice(0, 180) : "";

      const content = CONTENT[kind];
      if (!content) return json({ error: "Tipo de notificação inválido." }, 400);


      let query = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth");

      if (kind === "admin_test") {
        if (!password || !targetEndpoint) return json({ error: "Autenticação e aparelho de destino obrigatórios." }, 400);
        const { data: isAdmin, error: adminError } = await admin.rpc("_check_admin", { _password: password });
        if (adminError || isAdmin !== true) return json({ error: "Acesso negado." }, 403);
        // Nunca faz broadcast de um teste e nunca envia para endpoints fora do cadastro ADM.
        query = query.eq("scope", "admin").eq("endpoint", targetEndpoint);
      } else if (content.audience === "admin") {
        if (!key) return json({ error: "Chave ausente." }, 400);
        if (messageId) {
          // A mesma regra do suporte: chave existente/não revogada, mesmo após expirar.
          // Exige uma mensagem recente, realmente salva, pertencente a essa chave.
          const { data: keyRow, error: keyError } = await admin.from("access_keys")
            .select("id").eq("key", key.toUpperCase()).eq("revoked", false).maybeSingle();
          if (keyError) return json({ error: "Falha ao validar atendimento." }, 500);
          if (!keyRow) return json({ error: "Atendimento inválido." }, 403);
          const { data: thread, error: threadError } = await admin.from("support_threads")
            .select("id").eq("key_id", keyRow.id).maybeSingle();
          if (threadError) return json({ error: "Falha ao validar atendimento." }, 500);
          if (!thread) return json({ error: "Atendimento inválido." }, 403);
          const { data: message, error: messageError } = await admin.from("support_messages")
            .select("id").eq("id", messageId).eq("thread_id", thread.id).eq("sender_type", "user")
            .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString()).maybeSingle();
          if (messageError) return json({ error: "Falha ao validar mensagem." }, 500);
          if (!message) return json({ error: "Mensagem inválida ou antiga." }, 403);
        } else {
          // Clientes antigos continuam funcionando; não libera keys expiradas sem mensagem.
          const { data: validKey, error: keyError } = await admin.rpc("_valid_access_key", { _key: key });
          if (keyError) return json({ error: "Falha ao validar chave." }, 500);
          if (validKey !== true) return json({ error: "Chave inválida." }, 403);
        }
        query = query.eq("scope", "admin");
      } else if (kind === "expired") {
        // Autoaviso de expiração: a chave já expirou (não passa em _valid_access_key),
        // confere a expiração no servidor e limita o envio aos aparelhos dela.
        if (!key) return json({ error: "Chave ausente." }, 400);
        const { data: keyRow, error: keyError } = await admin
          .from("access_keys")
          .select("id, is_master, revoked, expires_at")
          .eq("key", key.toUpperCase())
          .maybeSingle();
        if (keyError) return json({ error: "Falha ao validar expiração." }, 500);
        if (!keyRow?.id || keyRow.is_master || keyRow.revoked || !keyRow.expires_at || Date.parse(keyRow.expires_at) > Date.now()) {
          return json({ error: "Chave não está expirada." }, 403);
        }
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


      const payload = JSON.stringify({
        title: content.title,
        body: content.audience === "admin" || kind === "expired" ? content.body : customBody || content.body,
        url: content.url,
        tag: `atlas-${kind}`,
      });
      const stale: string[] = [];
      let sent = 0;
      let failed = 0;

      for (const sub of subs) {
        try {
          await sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          sent++;
        } catch (err) {
          failed++;
          const status = (err as { statusCode?: number })?.statusCode;
          console.error(`Envio push falhou [${status ?? "?"}].`);
          if (status === 404 || status === 410) stale.push(sub.id);
        }
      }

      if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);

      return json({ sent, failed, removed: stale.length }, sent === 0 && failed > 0 ? 502 : 200);
    } catch (err) {
      console.error("notify-admin falhou:", (err as Error)?.message);
      return json({ error: "Não foi possível concluir o envio." }, 500);
    }
  };
}
