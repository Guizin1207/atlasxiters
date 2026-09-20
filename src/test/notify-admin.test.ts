// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createNotifyHandler } from "../../supabase/functions/notify-admin/handler";

type Row = Record<string, unknown>;
function fixture(options: { adminValid?: boolean; userValid?: boolean; keyExpired?: boolean; revoked?: boolean } = {}) {
  const rows: Record<string, Row[]> = {
    access_keys: [{ id: "key-a", key: "KEY-A", is_master: false, revoked: options.revoked ?? false, expires_at: options.keyExpired === false ? "2099-01-01T00:00:00Z" : "2000-01-01T00:00:00Z" }],
    support_threads: [{ id: "thread-a", key_id: "key-a" }],
    support_messages: [{ id: "message-a", thread_id: "thread-a", sender_type: "user", created_at: new Date().toISOString() }],
    push_subscriptions: [
      { id: "admin-a", endpoint: "https://push.test/admin-a", scope: "admin", key_id: null, p256dh: "p", auth: "a" },
      { id: "admin-b", endpoint: "https://push.test/admin-b", scope: "admin", key_id: null, p256dh: "p", auth: "a" },
      { id: "user-a", endpoint: "https://push.test/user-a", scope: "user", key_id: "key-a", p256dh: "p", auth: "a" },
      { id: "user-b", endpoint: "https://push.test/user-b", scope: "user", key_id: "key-b", p256dh: "p", auth: "a" },
    ],
  };
  const filters: Array<[string, string, unknown]> = [];
  const from = (table: string) => {
    let data = [...(rows[table] ?? [])];
    const query = {
      select() { return query; },
      eq(column: string, value: unknown) {
        filters.push([table, column, value]); data = data.filter((r) => r[column] === value); return query;
      },
      gte(column: string, value: string) { data = data.filter((r) => String(r[column]) >= value); return query; },
      maybeSingle() { return Promise.resolve({ data: data[0] ?? null, error: null }); },
      delete() { return query; },
      in() { return Promise.resolve({ data: [], error: null }); },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data, error: null }).then(resolve); },
    };
    return query;
  };
  const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({
    data: name === "_check_admin" ? (options.adminValid ?? true) : options.userValid !== false && options.keyExpired === false,
    error: null,
  }));
  const sendNotification = vi.fn().mockResolvedValue(undefined);
  const admin = { from, rpc } as unknown as Parameters<typeof createNotifyHandler>[0]["admin"];
  const handler = createNotifyHandler({ admin, pushConfigured: true, corsHeaders: {}, sendNotification });
  const send = (body: Row) => handler(new Request("https://api.test/notify-admin", { method: "POST", body: JSON.stringify(body) }));
  return { send, sendNotification, rpc, filters, rows };
}

describe("destinatários e autorização do servidor push", () => {
  it("teste do ADM exige autenticação válida", async () => {
    const f = fixture({ adminValid: false });
    const result = await f.send({ kind: "admin_test", password: "wrong", targetEndpoint: "https://push.test/admin-a" });
    expect(result.status).toBe(403);
    expect(f.sendNotification).not.toHaveBeenCalled();
  });

  it("teste vai só ao endpoint ADM solicitado, nunca aos usuários/outros ADMs", async () => {
    const f = fixture();
    const result = await f.send({ kind: "admin_test", password: "admin", targetEndpoint: "https://push.test/admin-a" });
    expect(result.status).toBe(200);
    expect(f.sendNotification).toHaveBeenCalledTimes(1);
    expect(f.sendNotification.mock.calls[0][0].endpoint).toBe("https://push.test/admin-a");
  });

  it("não transforma teste sem destino em broadcast", async () => {
    const f = fixture();
    expect((await f.send({ kind: "admin_test", password: "admin" })).status).toBe(400);
    expect(f.sendNotification).not.toHaveBeenCalled();
  });

  it("mensagem salva de key expirada pode notificar os ADMs", async () => {
    const f = fixture({ keyExpired: true });
    expect((await f.send({ kind: "message", key: "KEY-A", messageId: "message-a" })).status).toBe(200);
    expect(f.sendNotification.mock.calls.map(([target]) => target.endpoint)).toEqual(["https://push.test/admin-a", "https://push.test/admin-b"]);
    expect(f.filters).toContainEqual(["support_messages", "thread_id", "thread-a"]);
    expect(f.filters).toContainEqual(["support_messages", "sender_type", "user"]);
  });

  it("rejeita mensagem de outra conversa", async () => {
    const f = fixture();
    f.rows.support_messages[0].thread_id = "thread-b";
    expect((await f.send({ kind: "message", key: "KEY-A", messageId: "message-a" })).status).toBe(403);
    expect(f.sendNotification).not.toHaveBeenCalled();
  });

  it("não permite key revogada disparar mensagens", async () => {
    const f = fixture({ revoked: true });
    expect((await f.send({ kind: "message", key: "KEY-A", messageId: "message-a" })).status).toBe(403);
  });

  it("expiração é individual, nunca enviada ao ADM nem a outra key", async () => {
    const f = fixture();
    expect((await f.send({ kind: "expired", key: "KEY-A" })).status).toBe(200);
    expect(f.sendNotification).toHaveBeenCalledTimes(1);
    expect(f.sendNotification.mock.calls[0][0].endpoint).toBe("https://push.test/user-a");
  });

  it("rejeita aviso falso de expiração para uma key ainda ativa", async () => {
    const f = fixture({ keyExpired: false });
    expect((await f.send({ kind: "expired", key: "KEY-A" })).status).toBe(403);
    expect(f.sendNotification).not.toHaveBeenCalled();
  });

  it("não reporta sucesso quando o provedor rejeita todos os envios", async () => {
    const f = fixture();
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    f.sendNotification.mockRejectedValue({ statusCode: 410 });
    const result = await f.send({ kind: "admin_test", password: "admin", targetEndpoint: "https://push.test/admin-a" });
    expect(result.status).toBe(502);
    expect(await result.json()).toMatchObject({ sent: 0, failed: 1, removed: 1, code: "PUSH_SUBSCRIPTION_EXPIRED", version: 2 });
    quiet.mockRestore();
  });

  it("uma resposta chega a todos os aparelhos da mesma key e a nenhum outro usuário", async () => {
    const f = fixture();
    f.rows.push_subscriptions.push({ ...f.rows.push_subscriptions[2], id: "user-a-2", endpoint: "https://push.test/user-a-2" });
    expect((await f.send({ kind: "reply", password: "admin", targetKey: "KEY-A" })).status).toBe(200);
    expect(f.sendNotification.mock.calls.map(([target]) => target.endpoint)).toEqual(["https://push.test/user-a", "https://push.test/user-a-2"]);
  });

  it("resposta sem destinatário não vira aviso para todos", async () => {
    const f = fixture();
    expect((await f.send({ kind: "reply", password: "admin" })).status).toBe(400);
    expect(f.sendNotification).not.toHaveBeenCalled();
  });

  it("usuário só testa o aparelho vinculado à sua key", async () => {
    const f = fixture({ keyExpired: false });
    const own = await f.send({ kind: "user_test", key: "KEY-A", targetEndpoint: "https://push.test/user-a" });
    expect((await own.json()).sent).toBe(1);
    f.sendNotification.mockClear();
    const other = await f.send({ kind: "user_test", key: "KEY-A", targetEndpoint: "https://push.test/user-b" });
    expect((await other.json()).sent).toBe(0);
    expect(f.sendNotification).not.toHaveBeenCalled();
  });

  it("usuário não pode usar seu teste para enviar ao ADM", async () => {
    const f = fixture({ keyExpired: false });
    const result = await f.send({ kind: "user_test", key: "KEY-A", targetEndpoint: "https://push.test/admin-a" });
    expect((await result.json()).sent).toBe(0);
    expect(f.sendNotification).not.toHaveBeenCalled();
  });

  it("teste de usuário exige key válida", async () => {
    const f = fixture({ keyExpired: false, userValid: false });
    expect((await f.send({ kind: "user_test", key: "KEY-A", targetEndpoint: "https://push.test/user-a" })).status).toBe(403);
    expect(f.sendNotification).not.toHaveBeenCalled();
  });

  it("uma falha de um dispositivo não interrompe os outros", async () => {
    const f = fixture();
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    f.sendNotification.mockRejectedValueOnce({ statusCode: 410 });
    const result = await f.send({ kind: "message", key: "KEY-A", messageId: "message-a" });
    expect(await result.json()).toMatchObject({ sent: 1, failed: 1, removed: 1 });
    expect(f.sendNotification).toHaveBeenCalledTimes(2);
    quiet.mockRestore();
  });

  it("nomes herdados do protótipo não são tipos de notificação válidos", async () => {
    const f = fixture();
    expect((await f.send({ kind: "__proto__" })).status).toBe(400);
    expect(f.sendNotification).not.toHaveBeenCalled();
  });
});
