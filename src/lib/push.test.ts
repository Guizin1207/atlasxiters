import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { adminPushState, currentPushStatus, enableAdminPush, enableUserPush, disableAdminPush, disableUserPush, notifyExpired, notifyAdmin, resetExpiryNotification, testAdminPush, testUserPush, registerPushServiceWorker, retireOtherUserPush } from "./push";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke } } }));

const endpoint = "https://push.example.test/current";
const subscription = {
  endpoint,
  unsubscribe: vi.fn().mockResolvedValue(true),
  toJSON: () => ({ endpoint, keys: { p256dh: "public-key", auth: "push-auth" } }),
};
const registration = { scope: `${location.origin}/push/admin/`, active: {} as ServiceWorker | null, pushManager: { getSubscription: vi.fn(), subscribe: vi.fn() } };
const userEndpoint = "https://push.example.test/user-current";
const userSubscription = {
  endpoint: userEndpoint, unsubscribe: vi.fn().mockResolvedValue(true),
  toJSON: () => ({ endpoint: userEndpoint, keys: { p256dh: "user-public-key", auth: "user-push-auth" } }),
};
const userRegistration = { scope: `${location.origin}/push/user/`, active: {}, pushManager: { getSubscription: vi.fn(), subscribe: vi.fn() } };
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
    getRegistration: vi.fn().mockImplementation((scope: string) => Promise.resolve(scope === "/push/admin/" ? registration : scope === "/push/user/" ? userRegistration : undefined)),
    register: vi.fn().mockImplementation((_: string, options: { scope: string }) => Promise.resolve(options.scope === "/push/admin/" ? registration : userRegistration)),
    ready: new Promise(() => {}),
  } });
  registration.active = {} as ServiceWorker;
  registration.scope = `${location.origin}/push/admin/`;
  registration.pushManager.getSubscription.mockResolvedValue(subscription);
  userRegistration.pushManager.getSubscription.mockResolvedValue(userSubscription);
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
    expect(JSON.parse(localStorage.getItem("atlas_push_binding_v2:admin")!).scope).toBe("admin");
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
    expect(localStorage.getItem("atlas_push_binding_v2:admin")).toBeNull();
  });

  it("ADM e usuário podem receber no mesmo navegador, com inscrições independentes", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: row("admin"), error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    expect(await enableAdminPush("admin-password")).toBe("enabled");
    expect(await enableUserPush("KEY-A")).toBe("enabled");
    expect(JSON.parse(localStorage.getItem("atlas_push_binding_v2:admin")!).endpoint).toBe(endpoint);
    expect(JSON.parse(localStorage.getItem("atlas_push_binding_v2:user")!).endpoint).toBe(userEndpoint);
    expect(mocks.rpc.mock.calls[1][1]._endpoint).toBe(userEndpoint);
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith("/sw.js", { scope: "/push/admin/" });
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith("/sw.js", { scope: "/push/user/" });
  });

  it("desativar os avisos do usuário não desativa os avisos do ADM", async () => {
    localStorage.setItem("atlas_push_binding_v2:admin", JSON.stringify({ endpoint, scope: "admin" }));
    localStorage.setItem("atlas_push_binding_v2:user", JSON.stringify({ endpoint: userEndpoint, scope: "user", key: "KEY-A" }));
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await disableUserPush("KEY-A");
    expect(userSubscription.unsubscribe).toHaveBeenCalledOnce();
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
    expect(localStorage.getItem("atlas_push_binding_v2:admin")).not.toBeNull();
  });

  it("trocar de key remove só os avisos da key anterior neste navegador", async () => {
    localStorage.setItem("atlas_push_binding_v2:admin", JSON.stringify({ endpoint, scope: "admin" }));
    localStorage.setItem("atlas_push_binding_v2:user", JSON.stringify({ endpoint: userEndpoint, scope: "user", key: "KEY-A" }));
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await retireOtherUserPush("KEY-B");
    expect(userSubscription.unsubscribe).toHaveBeenCalledOnce();
    expect(subscription.unsubscribe).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("user_delete_push_subscription", { _key: "KEY-A", _endpoint: userEndpoint });
    expect(localStorage.getItem("atlas_push_binding_v2:user")).toBeNull();
    expect(localStorage.getItem("atlas_push_binding_v2:admin")).not.toBeNull();
  });

  it("o worker antigo da raiz não é confundido com a inscrição de ADM", async () => {
    registration.scope = `${location.origin}/`;
    mocks.rpc.mockResolvedValue({ data: [row("admin")], error: null });
    expect((await adminPushState("admin-password")).status).toBe("ready");
  });

  it("não depende do worker da página para ativar o worker do papel", async () => {
    expect(await registerPushServiceWorker("admin")).toBe(registration);
    // ready fica pendente no mock: a ativação correta usa registration.active.
  });

  it("espera a primeira instalação do worker do usuário terminar", async () => {
    const worker = Object.assign(new EventTarget(), { state: "installing" });
    const installing = Object.assign(new EventTarget(), { active: null as null | typeof worker, installing: worker, waiting: null });
    vi.mocked(navigator.serviceWorker.register).mockResolvedValueOnce(installing as unknown as ServiceWorkerRegistration);
    const pending = registerPushServiceWorker("user");
    await Promise.resolve();
    worker.state = "activated";
    installing.active = worker;
    worker.dispatchEvent(new Event("statechange"));
    expect(await pending).toBe(installing);
  });

  it("uma instalação que não termina dá erro recuperável em vez de travar o botão", async () => {
    const worker = Object.assign(new EventTarget(), { state: "installing" });
    const installing = Object.assign(new EventTarget(), { active: null, installing: worker, waiting: null });
    vi.mocked(navigator.serviceWorker.register).mockResolvedValueOnce(installing as unknown as ServiceWorkerRegistration);
    const expected = expect(registerPushServiceWorker("admin")).rejects.toThrow("Tente novamente");
    await vi.advanceTimersByTimeAsync(12_000);
    await expected;
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

  it("o teste de usuário manda sua key e seu endpoint, sem credencial ADM", async () => {
    localStorage.setItem("atlas_push_binding_v2:user", JSON.stringify({ endpoint: userEndpoint, scope: "user", key: "KEY-A" }));
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    expect((await testUserPush("KEY-A")).ok).toBe(true);
    expect(mocks.invoke).toHaveBeenCalledWith("notify-admin", { body: { kind: "user_test", key: "KEY-A", targetEndpoint: userEndpoint } });
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
