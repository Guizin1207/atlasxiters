import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { adminPushState, currentPushStatus, enableAdminPush, enableUserPush, disableAdminPush, notifyExpired, notifyAdmin, resetExpiryNotification, testAdminPush } from "./push";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));

const endpoint = "https://push.example.test/current";
const subscription = {
  endpoint,
  unsubscribe: vi.fn().mockResolvedValue(true),
  toJSON: () => ({ endpoint, keys: { p256dh: "public-key", auth: "push-auth" } }),
};
const registration = { pushManager: { getSubscription: vi.fn(), subscribe: vi.fn() } };
const row = (scope: string, id = "current") => ({ id, endpoint, scope, device: "iOS", created_at: "2026-09-20T00:00:00Z" });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));
  vi.clearAllMocks();
  localStorage.clear(); sessionStorage.clear();
  resetExpiryNotification("KEY-A");
  vi.stubGlobal("Notification", { permission: "granted", requestPermission: vi.fn().mockResolvedValue("granted") });
  vi.stubGlobal("PushManager", function () {});
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {
    getRegistration: vi.fn().mockResolvedValue(registration),
    register: vi.fn().mockResolvedValue(registration),
    ready: Promise.resolve(registration),
  } });
  registration.pushManager.getSubscription.mockResolvedValue(subscription);
  mocks.rpc.mockReset(); mocks.invoke.mockReset();
  mocks.invoke.mockResolvedValue({ data: { sent: 1 }, error: null });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("vínculo do aparelho do ADM", () => {
  it("não considera uma inscrição de usuário como inscrição do ADM", async () => {
    mocks.rpc.mockResolvedValue({ data: [row("user")], error: null });
    expect((await adminPushState("admin-password")).status).toBe("ready");
  });

  it("só confirma ADM quando este endpoint está cadastrado como admin", async () => {
    mocks.rpc.mockResolvedValue({ data: [row("admin")], error: null });
    expect((await adminPushState("admin-password")).status).toBe("enabled");
    expect(JSON.parse(localStorage.getItem("atlas_push_binding_v1")!).scope).toBe("admin");
  });

  it("corrige o upsert legado substituindo somente o vínculo deste aparelho", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: row("user"), error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: row("admin", "replacement"), error: null });
    expect(await enableAdminPush("admin-password")).toBe("enabled");
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "admin_save_push_subscription", "admin_delete_push_subscription", "admin_save_push_subscription",
    ]);
    expect(mocks.rpc.mock.calls[1][1]).toEqual({ _password: "admin-password", _id: "current" });
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });

  it("não anuncia sucesso se o servidor não confirmou o vínculo", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "denied" } });
    await expect(enableAdminPush("bad-password")).rejects.toThrow();
    expect(localStorage.getItem("atlas_push_binding_v1")).toBeNull();
  });

  it("a ativação de usuário não sobrescreve o aparelho do ADM", async () => {
    localStorage.setItem("atlas_push_binding_v1", JSON.stringify({ endpoint, scope: "admin" }));
    expect(await enableUserPush("KEY-A")).toBe("admin-device");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("remover outro aparelho não desliga este", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await disableAdminPush("admin-password", "other", "https://push.example.test/other");
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
  });

  it("envia teste remoto só para o endpoint atual", async () => {
    mocks.rpc.mockResolvedValue({ data: [row("admin")], error: null });
    expect((await testAdminPush("admin-password")).ok).toBe(true);
    expect(mocks.invoke).toHaveBeenCalledWith("notify-admin", {
      body: { kind: "admin_test", password: "admin-password", targetEndpoint: endpoint },
    });
  });

  it("permissão no navegador sem vínculo não aparece como enabled", async () => {
    expect(await currentPushStatus("KEY-A")).toBe("ready");
  });

  it("avisa da instalação necessária no iPhone sem pedir permissão", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("iPhone");
    expect(await enableAdminPush("admin-password")).toBe("ios-needs-install");
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("confirmação de envio", () => {
  it("não ignora erros devolvidos pelo invoke", async () => {
    mocks.invoke.mockResolvedValue({ error: { message: "Forbidden" }, data: null });
    expect((await notifyAdmin("message", "KEY-A", "message-id")).ok).toBe(false);
  });

  it("não marca expiração como enviada quando nenhum aparelho recebeu", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: { sent: 0 }, error: null });
    await notifyExpired("KEY-A");
    await vi.advanceTimersByTimeAsync(60_000);
    await notifyExpired("KEY-A");
    await notifyExpired("KEY-A");
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem("atlas_expired_delivered_v2:KEY-A")).toBe("1");
  });

  it("renovação libera o próximo ciclo de expiração", async () => {
    await notifyExpired("KEY-A");
    resetExpiryNotification("KEY-A");
    await notifyExpired("KEY-A");
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
  });
});
