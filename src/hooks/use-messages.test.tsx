import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMessages } from "./use-messages";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), key: "KEY-A" as string | null, expiredKey: null as string | null, toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("@/lib/key-context", () => ({ useKey: () => ({ keyData: mocks.key ? { key: mocks.key, id: mocks.key } : null, expiredKey: mocks.expiredKey }) }));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: mocks.rpc, channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: vi.fn(),
} }));
const message = { id: "message-a", title: "Sua key foi expirada", body: "Renove no suporte.", created_at: "2026-09-20T12:00:00Z", is_direct: true, is_read: false };
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  mocks.key = "KEY-A"; mocks.expiredKey = null;
  mocks.rpc.mockReset().mockResolvedValue({ data: [], error: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("avisos por key", () => {
  it("encerra carregamento sem key e também em erro de servidor", async () => {
    mocks.key = null;
    const hook = renderHook(() => useMessages());
    await act(async () => {});
    expect(hook.result.current.loading).toBe(false);
    mocks.key = "KEY-A";
    mocks.rpc.mockResolvedValue({ error: { message: "offline" }, data: null });
    hook.rerender(); await act(async () => {});
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.loadError).toBe(true);
  });

  it("reconsulta mesmo quando o Realtime não entrega evento", async () => {
    const { result } = renderHook(() => useMessages());
    await act(async () => {});
    mocks.rpc.mockResolvedValue({ data: [message], error: null });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(result.current.unread).toBe(1);
    expect(mocks.toast.error).toHaveBeenCalledWith(message.title, expect.any(Object));
  });

  it("não vaza o histórico nem respostas atrasadas de outra key", async () => {
    let finish: (value: unknown) => void;
    mocks.rpc.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const hook = renderHook(() => useMessages());
    mocks.key = "KEY-B"; hook.rerender();
    await act(async () => {});
    await act(async () => { finish!({ data: [message], error: null }); });
    expect(hook.result.current.messages).toEqual([]);
  });

  it("consulta mensagens da key expirada apenas para atendimento", async () => {
    mocks.key = null; mocks.expiredKey = "KEY-A";
    renderHook(() => useMessages()); await act(async () => {});
    expect(mocks.rpc).toHaveBeenCalledWith("list_my_messages", { _key: "KEY-A" });
  });

  it("não marca como lida se o servidor recusou", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [message], error: null });
    const { result } = renderHook(() => useMessages()); await act(async () => {});
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "denied" } });
    await act(async () => { await result.current.markAllRead(); });
    expect(result.current.unread).toBe(1);
  });
});
