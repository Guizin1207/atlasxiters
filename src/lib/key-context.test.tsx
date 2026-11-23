import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeyProvider, useKey } from "./key-context";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), authSignOut: vi.fn().mockResolvedValue({ error: null }), notifyExpired: vi.fn(), resetExpiryNotification: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc, auth: { signOut: mocks.authSignOut } } }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ session: { user: { id: "user-a" } } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/push", () => ({ notifySecurity: vi.fn(), notifyExpired: mocks.notifyExpired, resetExpiryNotification: mocks.resetExpiryNotification, retireOtherUserPush: vi.fn().mockResolvedValue(undefined) }));

const activeKey = {
  id: "key-a", key: "KEY-A", is_master: false, revoked: false,
  expires_at: "2026-09-20T13:00:00Z", activated_at: "2026-09-19T12:00:00Z",
};
const expiredResponse = { data: null, error: { message: "expired_key" } };
async function mount() {
  const hook = renderHook(() => useKey(), { wrapper: KeyProvider });
  await act(async () => {});
  return hook;
}

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-20T12:00:00Z"));
  localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks();
  localStorage.setItem("atlas_vip_key", "KEY-A");
  mocks.rpc.mockReset().mockResolvedValue({ data: activeKey, error: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("expiração individual", () => {
  it("valida uma vez e não entra em loop por atualizar keyData", async () => {
    const { result } = await mount();
    expect(result.current.keyData?.key).toBe("KEY-A");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("bloqueia e mostra expiração retornada pelo servidor mesmo com data local futura", async () => {
    const { result } = await mount();
    mocks.rpc.mockResolvedValue(expiredResponse);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(result.current.keyData).toBeNull();
    expect(result.current.expiredKey).toBe("KEY-A");
    expect(mocks.notifyExpired).toHaveBeenCalledWith("KEY-A");
  });

  it("o relógio bloqueia na hora mesmo sem rede", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ...activeKey, expires_at: "2026-09-20T12:00:02Z" }, error: null });
    const { result } = await mount();
    mocks.rpc.mockRejectedValue(new Error("offline"));
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(result.current.keyData).toBeNull();
    expect(result.current.expiredKey).toBe("KEY-A");
  });

  it("restaura o aviso na abertura com uma key já expirada", async () => {
    mocks.rpc.mockResolvedValue(expiredResponse);
    const { result } = await mount();
    expect(result.current.loading).toBe(false);
    expect(result.current.expiredKey).toBe("KEY-A");
    expect(result.current.keyData).toBeNull();
  });

  it("retira o aviso somente após o servidor confirmar a renovação", async () => {
    mocks.rpc.mockResolvedValue(expiredResponse);
    const { result } = await mount();
    mocks.rpc.mockResolvedValue({ data: activeKey, error: null });
    await act(async () => { await result.current.refresh(); });
    expect(result.current.expiredKey).toBeNull();
    expect(result.current.keyData?.key).toBe("KEY-A");
  });

  it("mantém a identidade do aparelho ao colocar o app em segundo plano", async () => {
    const { result } = await mount();
    const id = result.current.deviceId;
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(localStorage.getItem("atlas_vip_device_id")).toBe(id);
    expect(localStorage.getItem("atlas_vip_key")).toBe("KEY-A");
  });

  it("resposta antiga não restaura a key depois de sair", async () => {
    let finish: ((value: unknown) => void) | undefined;
    mocks.rpc.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result } = await mount();
    act(() => result.current.signOut());
    await act(async () => { finish?.({ data: activeKey, error: null }); });
    expect(result.current.keyData).toBeNull();
    expect(localStorage.getItem("atlas_vip_key")).toBeNull();
  });
});

describe("revogação desconecta a conta", () => {
  it("remove o acesso e a sessão quando a validação informa revogação", async () => {
    const { result } = await mount();
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "revoked_key" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(result.current.keyData).toBeNull();
    expect(result.current.expiredKey).toBeNull();
    expect(localStorage.getItem("atlas_vip_key")).toBeNull();
    expect(sessionStorage.getItem("atlas_vip_auth_error")).toBe("revoked_key");
    expect(mocks.authSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("get_my_access_key");
  });

  it("não recupera uma chave revogada vinculada à conta sem cache", async () => {
    localStorage.removeItem("atlas_vip_key");
    mocks.rpc.mockResolvedValue({ data: { ...activeKey, revoked: true }, error: null });
    const { result } = await mount();
    expect(result.current.keyData).toBeNull();
    expect(mocks.authSignOut).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("atlas_vip_auth_error")).toBe("revoked_key");
  });

  it("falha de rede não desconecta uma conta com acesso válido", async () => {
    const { result } = await mount();
    mocks.rpc.mockRejectedValue(new Error("offline"));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.keyData?.key).toBe("KEY-A");
    expect(mocks.authSignOut).not.toHaveBeenCalled();
  });
});
