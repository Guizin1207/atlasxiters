import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminProvider, useAdmin } from "./admin-context";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
const SESSION_KEY = "atlas_vip_admin_pwd";

async function mount() {
  const hook = renderHook(() => useAdmin(), { wrapper: AdminProvider });
  await act(async () => {});
  return hook;
}

beforeEach(() => {
  sessionStorage.clear();
  mocks.rpc.mockReset().mockResolvedValue({ data: false, error: null });
});
afterEach(cleanup);

describe("autenticação ADM compatível com o acesso antigo", () => {
  it("reconhecimento não cria sessão nem armazena a credencial", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const { result } = await mount();
    await act(async () => { expect(await result.current.recognize("AdmTeste")).toBe(true); });
    expect(result.current.password).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("preserva a senha exata quando aceita pelo servidor", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const { result } = await mount();
    await act(async () => { expect(await result.current.signIn("MinhaSenha")).toBe(true); });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(result.current.password).toBe("MinhaSenha");
    expect(sessionStorage.getItem(SESSION_KEY)).toBe("MinhaSenha");
  });

  it("restaura a conversão do login antigo e guarda somente a credencial validada", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    const { result } = await mount();
    await act(async () => { expect(await result.current.signIn("  minha-chave  ")).toBe(true); });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "_check_admin", { _password: "minha-chave" });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "_check_admin", { _password: "MINHA-CHAVE" });
    expect(result.current.password).toBe("MINHA-CHAVE");
    expect(sessionStorage.getItem(SESSION_KEY)).toBe("MINHA-CHAVE");
  });

  it("não libera acesso quando o servidor recusa os dois formatos", async () => {
    const { result } = await mount();
    await act(async () => { expect(await result.current.signIn("errada")).toBe(false); });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(result.current.password).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("não duplica a validação de uma senha que já está em maiúsculas", async () => {
    const { result } = await mount();
    await act(async () => { expect(await result.current.signIn("ERRADA")).toBe(false); });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    { data: null, error: { code: "PGRST202", message: "backend detail that must remain private" } },
    { data: null, error: null },
    { data: "true", error: null },
  ])("falha ou resposta inesperada do servidor não vira senha inválida nem libera sessão: %j", async (response) => {
    mocks.rpc.mockResolvedValue(response);
    const { result } = await mount();
    await act(async () => {
      await expect(result.current.signIn("minha-chave")).rejects.toThrow("admin_validation_unavailable");
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(result.current.password).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("não apaga a credencial salva por uma falha de conexão e não autentica offline", async () => {
    sessionStorage.setItem(SESSION_KEY, "MINHA-CHAVE");
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    const { result } = await mount();
    expect(result.current.loading).toBe(false);
    expect(result.current.password).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBe("MINHA-CHAVE");
  });

  it("apaga a sessão quando o servidor confirma que a credencial salva não é válida", async () => {
    sessionStorage.setItem(SESSION_KEY, "ACESSO-REVOGADO");
    const { result } = await mount();
    expect(result.current.password).toBeNull();
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
