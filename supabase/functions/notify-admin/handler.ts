import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };
type Dependencies = {
  admin: SupabaseClient;
  pushConfigured: boolean;
  pushConfigCode?: "PUSH_NOT_CONFIGURED" | "PUSH_CONFIG_INVALID";
  corsHeaders: Record<string, string>;
  sendNotification: (target: PushTarget, payload: string) => Promise<unknown>;
};

type Audience = "admin" | "user";

const CONTENT: Record<
  string,
  { title: string; body: string; audience: Audience; url: string }
> = {
  user_test: {
    title: "Atlas VIP — Teste do usuário",
    body: "Este aparelho está vinculado às notificações da sua key.",
    audience: "user",
    url: "/painel",
  },
  admin_test: {
    title: "Atlas VIP — Teste do ADM chefe",
    body: "Este aparelho está vinculado aos avisos de mensagens e comprovantes do suporte.",
    audience: "admin",
    url: "/admin",
  },
  message: {
    title: "Atlas VIP — Novo atendimento",
    body: "Você recebeu uma nova mensagem no suporte.",
    audience: "admin",
    url: "/admin",
  },
  security: {
    title: "Atlas VIP — Alerta de segurança",
    body: "Foi detectada uma tentativa suspeita de acesso ou uso de key.",
    audience: "admin",
    url: "/admin",
  },
  receipt: {
    title: "Atlas VIP — Novo comprovante",
    body: "Um cliente enviou um comprovante.",
    audience: "admin",
    url: "/admin",
  },
  reply: {
    title: "Atlas VIP — Suporte respondeu",
    body: "Você recebeu uma nova mensagem no chat de suporte.",
    audience: "user",
    url: "/painel?suporte=1",
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
  reward_ready: {
    title: "Atlas VIP — Resgate disponível",
    body: "Seu resgate de coins já está disponível!",
    audience: "user",
    url: "/painel",
  },
  coins_added: {
    title: "Atlas VIP — Coins recebidos",
    body: "Você recebeu novos Atlas Coins!",
    audience: "user",
    url: "/painel",
  },
  daily_reward: {
    title: "Atlas VIP — Coin diário disponível",
    body: "Seu coin diário já está disponível para resgate!",
    audience: "user",
    url: "/painel",
  },
  maintenance_end: {
    title: "Atlas VIP — Manutenção concluída",
    body: "Tudo normalizado. O painel já está liberado.",
    audience: "user",
    url: "/painel",
  },
  expired: {
    title: "Atlas VIP — Sua key foi expirada",
    body: "Sua key foi expirada. Fale com o suporte para renovar seu acesso.",
    audience: "user",
    url: "/painel?suporte=1",
  },
};

const TESTABLE_KINDS = new Set([
  "user_test",
  "message",
  "receipt",
  "reply",
  "notice",
  "update",
  "maintenance",
  "maintenance_end",
  "reward_ready",
  "coins_added",
  "daily_reward",
  "expired",
]);

export function createNotifyHandler({ admin, pushConfigured, pushConfigCode = "PUSH_NOT_CONFIGURED", corsHeaders, sendNotification }: Dependencies) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const json = (payload: Record<string, unknown>, status = 200) =>
      new Response(JSON.stringify({ ...payload, version: 6 }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    try {
      if (!pushConfigured) {
        return json({ code: pushConfigCode, error: "Notificações não configuradas." }, 500);
      }

      const raw = await req.json().catch(() => null);
      const kind = String(raw?.kind ?? "");
      const key = typeof raw?.key === "string" ? raw.key.trim() : "";
      const password = typeof raw?.password === "string" ? raw.password : "";
      const targetKey = typeof raw?.targetKey === "string" ? raw.targetKey.trim() : "";
      const targetEndpoint = typeof raw?.targetEndpoint === "string" ? raw.targetEndpoint.trim() : "";
      const messageId = typeof raw?.messageId === "string" ? raw.messageId : "";
      const customBody = typeof raw?.body === "string" ? raw.body.trim().slice(0, 180) : "";
      const customTitle = typeof raw?.title === "string" ? raw.title.trim().slice(0, 80) : "";
      const cronToken = typeof raw?.cronToken === "string" ? raw.cronToken : "";
      const eventId = typeof raw?.eventId === "string" ? raw.eventId.trim() : "";

      if (kind === "security") {
        if (!eventId) return json({ error: "Evento de segurança ausente." }, 400);
        const { data: event, error: eventError } = await admin
          .from("security_events")
          .select("id, reason, key_hint, device, notified_at, created_at")
          .eq("id", eventId)
          .maybeSingle();
        if (eventError) return json({ code: "DATABASE_ERROR", error: "Falha ao validar alerta." }, 500);
        if (!event || event.notified_at || new Date(event.created_at).getTime() < Date.now() - 24 * 60 * 60 * 1000) {
          return json({ sent: 0, code: "EVENT_ALREADY_PROCESSED" });
        }

        const { data: securitySubs, error: securitySubsError } = await admin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth, key_id")
          .eq("scope", "admin");
        if (securitySubsError) return json({ code: "DATABASE_ERROR", error: "Falha ao listar aparelhos do ADM." }, 500);
        if (!securitySubs?.length) return json({ sent: 0, removed: 0, code: "NO_RECIPIENTS" });

        const reasonLabel: Record<string, string> = {
          invalid_key: "key inválida/aleatória",
          revoked_key: "key revogada",
          device_mismatch: "key usada em outro dispositivo",
          account_mismatch: "key usada em outra conta",
        };
        const payload = JSON.stringify({
          title: "Atlas VIP — 🚨 Alerta de segurança",
          body: `Detectado: ${reasonLabel[event.reason] ?? "tentativa suspeita"}${event.key_hint ? ` • final da key: ****${event.key_hint}` : ""}.`,
          url: "/admin",
          tag: `atlas-security-${eventId}`,
        });
        const stale: string[] = [];
        let sent = 0;
        let failed = 0;
        for (const sub of securitySubs) {
          try {
            await sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            );
            sent++;
          } catch (err) {
            failed++;
            const status = (err as { statusCode?: number })?.statusCode;
            if (status === 404 || status === 410) stale.push(sub.id);
          }
        }
        if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);
        if (sent > 0) await admin.rpc("mark_security_event_notified", { _event_id: eventId });
        return json({ sent, failed, removed: stale.length });
      }

      if (kind === "notification_test") {
        if (!password) return json({ error: "Senha ausente." }, 400);
        const { data: isAdmin, error: adminError } = await admin.rpc("_check_admin", { _password: password });
        if (adminError || isAdmin !== true) return json({ code: "ADMIN_AUTH_FAILED", error: "Senha inválida." }, 403);

        const testKind = String(raw?.notificationKind ?? "");
        const targetTestKey = typeof raw?.targetKey === "string" ? raw.targetKey.trim() : "";
        if (!TESTABLE_KINDS.has(testKind) || testKind === "admin_test") {
          return json({ error: "Tipo de teste inválido." }, 400);
        }

        const testContent = CONTENT[testKind];
        let query = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth, key_id");
        if (testContent.audience === "admin") {
          query = query.eq("scope", "admin");
        } else {
          if (!targetTestKey) return json({ error: "Key de destino obrigatória." }, 400);
          const { data: keyRow, error: keyError } = await admin.from("access_keys")
            .select("id, is_master, revoked")
            .eq("key", targetTestKey.toUpperCase())
            .maybeSingle();
          if (keyError) return json({ code: "DATABASE_ERROR", error: "Falha ao validar key." }, 500);
          if (!keyRow?.id || keyRow.is_master || keyRow.revoked) {
            return json({ code: "REQUEST_FORBIDDEN", error: "Key inválida." }, 403);
          }
          query = query.eq("scope", "user").eq("key_id", keyRow.id);
        }

        const { data: testSubs, error: testSubsError } = await query;
        if (testSubsError) return json({ code: "DATABASE_ERROR", error: "Falha ao listar aparelhos." }, 500);
        if (!testSubs?.length) return json({ sent: 0, removed: 0, code: "NO_RECIPIENTS" });

        const payload = JSON.stringify({
          title: testContent.title,
          body: testContent.body,
          url: testContent.url,
          tag: `atlas-test-${testKind}`,
        });
        const stale: string[] = [];
        let sent = 0;
        let failed = 0;
        for (const sub of testSubs) {
          try {
            await sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            );
            sent++;
          } catch (err) {
            failed++;
            const status = (err as { statusCode?: number })?.statusCode;
            if (status === 404 || status === 410) stale.push(sub.id);
          }
        }
        if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);
        return json({ sent, failed, removed: stale.length, testedKind: testKind }, sent === 0 && failed > 0 ? 502 : 200);
      }

      let query = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth, key_id");
      const content = Object.prototype.hasOwnProperty.call(CONTENT, kind) ? CONTENT[kind] : null;
      if (!content) return json({ error: "Tipo de notificação inválido." }, 400);

      if (kind === "daily_reward") {
        const { data: tokenRow, error: tokenError } = await admin
          .from("app_config")
          .select("value")
          .eq("key", "reward_daily_cron_token")
          .maybeSingle();
        const expectedToken = typeof tokenRow?.value === "string"
          ? tokenRow.value
          : typeof tokenRow?.value === "object" && tokenRow?.value !== null
            ? String(tokenRow.value)
            : "";
        if (tokenError || !cronToken || cronToken !== expectedToken) {
          return json({ code: "CRON_AUTH_FAILED", error: "Agendamento não autorizado." }, 403);
        }
      }

      if (kind === "admin_test") {
        if (!password) return json({ error: "Autenticação obrigatória." }, 400);
        const { data: isAdmin, error: adminError } = await admin.rpc("_check_admin", { _password: password });
        if (adminError || isAdmin !== true) return json({ code: "ADMIN_AUTH_FAILED", error: "Acesso negado." }, 403);
        query = query.eq("scope", "admin");
      } else if (kind === "user_test") {
        if (!key || !targetEndpoint) return json({ error: "Key e aparelho de destino obrigatórios." }, 400);
        const { data: validKey, error: validError } = await admin.rpc("_valid_access_key", { _key: key });
        if (validError) return json({ code: "DATABASE_ERROR", error: "Falha ao validar key." }, 500);
        if (validKey !== true) return json({ code: "REQUEST_FORBIDDEN", error: "Key inválida." }, 403);
        const { data: keyRow, error: keyError } = await admin.from("access_keys")
          .select("id").eq("key", key.toUpperCase()).eq("revoked", false).maybeSingle();
        if (keyError) return json({ code: "DATABASE_ERROR", error: "Falha ao validar key." }, 500);
        if (!keyRow) return json({ code: "REQUEST_FORBIDDEN", error: "Key inválida." }, 403);
        query = query.eq("scope", "user").eq("key_id", keyRow.id).eq("endpoint", targetEndpoint);
      } else if (content.audience === "admin") {
        if (!key) return json({ error: "Chave ausente." }, 400);
        // Comprovante: valide a key e envie ao ADM sem depender de uma segunda consulta à thread.
        if (kind === "receipt") {
          const { data: validKey, error: keyError } = await admin.rpc("_valid_access_key", { _key: key });
          if (keyError) return json({ error: "Falha ao validar chave." }, 500);
          if (validKey !== true) return json({ error: "Chave inválida." }, 403);
          query = query.eq("scope", "admin");
        } else if (messageId) {
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
          const { data: validKey, error: keyError } = await admin.rpc("_valid_access_key", { _key: key });
          if (keyError) return json({ error: "Falha ao validar chave." }, 500);
          if (validKey !== true) return json({ error: "Chave inválida." }, 403);
        }
        query = query.eq("scope", "admin");
      } else if (kind === "daily_reward") {
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        const { data: keys, error: keysError } = await admin
          .from("access_keys")
          .select("id, expires_at, revoked, is_master")
          .eq("revoked", false)
          .eq("is_master", false);
        if (keysError) return json({ code: "DATABASE_ERROR", error: "Falha ao listar keys." }, 500);

        const { data: rewards, error: rewardsError } = await admin
          .from("key_rewards")
          .select("key_id, last_daily_claim");
        if (rewardsError) return json({ code: "DATABASE_ERROR", error: "Falha ao listar recompensas." }, 500);

        const rewardByKey = new Map<string, string | null>(
          (rewards ?? []).map((row) => [String(row.key_id), row.last_daily_claim ? String(row.last_daily_claim).slice(0, 10) : null]),
        );
        const eligible = new Set(
          (keys ?? [])
            .filter((row) => !row.expires_at || Date.parse(String(row.expires_at)) > Date.now())
            .filter((row) => rewardByKey.get(String(row.id)) !== today)
            .map((row) => String(row.id)),
        );

        query = query.eq("scope", "user");
        const { data: candidateSubs, error: candidateError } = await query;
        if (candidateError) return json({ code: "DATABASE_ERROR", error: "Falha ao listar aparelhos." }, 500);

        const eligibleSubs = (candidateSubs ?? []).filter((sub) => sub.key_id && eligible.has(String(sub.key_id)));
        const payload = JSON.stringify({
          title: content.title,
          body: content.body,
          url: content.url,
          tag: `atlas-daily-reward-${today}`,
        });

        const stale: string[] = [];
        let sent = 0;
        let failed = 0;
        let dailyNext = 0;

        await Promise.all(Array.from({ length: Math.min(8, eligibleSubs.length) }, async () => {
          while (dailyNext < eligibleSubs.length) {
            const sub = eligibleSubs[dailyNext++];
            try {
              await sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
              );
              sent++;
            } catch (err) {
              failed++;
              const status = (err as { statusCode?: number })?.statusCode;
              if (status === 404 || status === 410) stale.push(sub.id);
            }
          }
        }));

        if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);

        return json({
          sent,
          failed,
          removed: stale.length,
          eligibleKeys: eligible.size,
          code: sent > 0 ? undefined : "NO_RECIPIENTS",
        }, sent === 0 && failed > 0 ? 502 : 200);
      } else if (kind === "reward_ready") {
        if (!key) return json({ error: "Chave ausente." }, 400);
        const { data: keyRow, error: keyError } = await admin
          .from("access_keys")
          .select("id, is_master, revoked")
          .eq("key", key.toUpperCase())
          .maybeSingle();
        if (keyError) return json({ error: "Falha ao validar recompensa." }, 500);
        if (!keyRow?.id || keyRow.is_master || keyRow.revoked) return json({ error: "Chave inválida." }, 403);
        query = query.eq("scope", "user").eq("key_id", keyRow.id);
      } else if (kind === "coins_added") {
        if (!key) return json({ error: "Chave ausente." }, 400);
        const { data: keyRow, error: keyError } = await admin
          .from("access_keys")
          .select("id, is_master, revoked")
          .eq("key", key.toUpperCase())
          .maybeSingle();
        if (keyError) return json({ error: "Falha ao validar coins." }, 500);
        if (!keyRow?.id || keyRow.is_master || keyRow.revoked) return json({ error: "Chave inválida." }, 403);
        query = query.eq("scope", "user").eq("key_id", keyRow.id);
      } else if (kind === "expired") {
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
        if (!password) return json({ error: "Senha ausente." }, 400);
        const { data: isAdmin, error: adminError } = await admin.rpc("_check_admin", { _password: password });
        if (adminError) return json({ error: "Falha ao validar senha." }, 500);
        if (isAdmin !== true) return json({ code: "ADMIN_AUTH_FAILED", error: "Senha inválida." }, 403);
        if (kind === "reply" && !targetKey) return json({ error: "Destinatário da resposta obrigatório." }, 400);
        query = query.eq("scope", "user");

        if (targetKey) {
          // Resposta do ADM é entregue diretamente aos aparelhos da key do cliente.
          // Não depende da existência/conexão de nenhuma inscrição de ADM.
          const { data: keyRow, error: keyError } = await admin.from("access_keys")
            .select("id, is_master, revoked, expires_at")
            .eq("key", targetKey.toUpperCase())
            .maybeSingle();
          if (keyError) return json({ code: "DATABASE_ERROR", error: "Falha ao localizar destinatário." }, 500);
          if (!keyRow?.id || keyRow.is_master || keyRow.revoked) {
            return json({ sent: 0, removed: 0, code: "NO_RECIPIENTS" });
          }
          query = query.eq("key_id", keyRow.id);
        }
      }

      const { data: subs, error: subsError } = await query;
      if (subsError) return json({ code: "DATABASE_ERROR", error: "Falha ao listar inscrições." }, 500);
      if (!subs?.length) return json({ sent: 0, removed: 0, code: "NO_RECIPIENTS" });

      const payload = JSON.stringify({
        title: customTitle || content.title,
        body: content.audience === "admin" || kind === "expired" || kind === "user_test" ? content.body : customBody || content.body,
        url: content.url,
        tag: `atlas-${kind}`,
      });
      const stale: string[] = [];
      let sent = 0;
      let failed = 0;
      let credentialsRejected = false;
      let next = 0;

      await Promise.all(Array.from({ length: Math.min(8, subs.length) }, async () => {
        while (next < subs.length) {
          const sub = subs[next++];
          try {
            await sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            );
            sent++;
          } catch (err) {
            failed++;
            const status = (err as { statusCode?: number })?.statusCode;
            console.error("push falhou", kind, status, (err as { body?: string })?.body ?? (err as Error)?.message);
            if (status === 404 || status === 410) stale.push(sub.id);
            if (status === 401 || status === 403) credentialsRejected = true;
          }
        }
      }));

      if (stale.length) await admin.from("push_subscriptions").delete().in("id", stale);

      const code = sent > 0 ? undefined
        : credentialsRejected ? "PUSH_CREDENTIALS_REJECTED"
        : stale.length === failed ? "PUSH_SUBSCRIPTION_EXPIRED" : "PUSH_SEND_FAILED";
      return json({ sent, failed, removed: stale.length, code }, sent === 0 && failed > 0 ? 502 : 200);
    } catch (err) {
      console.error("notify-admin falhou:", (err as Error)?.message);
      return json({ error: "Não foi possível concluir o envio." }, 500);
    }
  };
}
