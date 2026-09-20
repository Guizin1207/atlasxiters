import { describe, expect, it } from "vitest";
import { pushFailure } from "./push-errors";

describe("diagnóstico da falha de push", () => {
  it("identifica a resposta real da função antiga e pede a publicação correta", async () => {
    const context = new Response(JSON.stringify({ error: "Tipo de notificação inválido." }), { status: 400 });
    const result = await pushFailure({ context });
    expect(result.code).toBe("FUNCTION_OUTDATED");
    expect(result.httpStatus).toBe(400);
    expect(result.message).toContain("Publique a função notify-admin atualizada");
  });

  it.each([
    [401, { code: 401, message: "Invalid JWT" }, "GATEWAY_AUTH_FAILED"],
    [500, { error: "Notificações não configuradas." }, "PUSH_NOT_CONFIGURED"],
    [502, { code: "PUSH_CREDENTIALS_REJECTED" }, "PUSH_CREDENTIALS_REJECTED"],
    [502, { code: "PUSH_SUBSCRIPTION_EXPIRED" }, "PUSH_SUBSCRIPTION_EXPIRED"],
    [503, { code: "BOOT_ERROR" }, "FUNCTION_BOOT_ERROR"],
    [404, {}, "FUNCTION_NOT_FOUND"],
  ])("distingue falhas do servidor (HTTP %s)", async (status, payload, code) => {
    const result = await pushFailure({ context: new Response(JSON.stringify(payload), { status }) });
    expect(result.code).toBe(code);
    expect(result.ok).toBe(false);
  });

  it("não exibe mensagens arbitrárias que possam conter segredos", async () => {
    const result = await pushFailure({ context: new Response(JSON.stringify({ error: "secret-test-value" }), { status: 500 }) });
    expect(result.message).not.toContain("secret-test-value");
  });
});
