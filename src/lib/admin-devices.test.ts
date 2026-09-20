import { beforeEach, describe, expect, it, vi } from "vitest";
import { beginAdminSession, currentAdminSessionId, endAdminSession, listAdminSessions, touchAdminSession } from "./admin-devices";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear(); mocks.rpc.mockReset().mockResolvedValue({ data: true, error: null });
  vi.spyOn(crypto, "randomUUID").mockReturnValue("12345678-1234-1234-1234-123456789abc");
});
describe("registro de acessos ADM", () => {
  it("registra a sessão e reutiliza a identidade do aparelho sem depender de push", async () => {
    localStorage.setItem("atlas_vip_device_id", "device-existing");
    beginAdminSession();
    await touchAdminSession("test-password");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_touch_access_session", expect.objectContaining({ _device_id: "device-existing", _session_id: currentAdminSessionId(), _password: "test-password" }));
    expect(localStorage.getItem("atlas_vip_device_id")).toBe("device-existing");
    expect(sessionStorage.getItem("atlas_admin_access_session")).not.toContain("test-password");
  });
  it("lista indisponível gera erro, nunca lista vazia que ocultaria uma falha", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(listAdminSessions("test-password")).rejects.toThrow("admin_device_registry_unavailable");
  });
  it("logout encerra somente a sessão atual", async () => {
    beginAdminSession(); const id = currentAdminSessionId();
    await endAdminSession("test-password");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_end_access_session", { _password: "test-password", _session_id: id });
    expect(currentAdminSessionId()).toBeNull();
  });
});
