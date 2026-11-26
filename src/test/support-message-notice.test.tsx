import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SupportMessageNotice } from "@/components/atlas/SupportMessageNotice";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
const reply = { id: "reply-1", thread_id: "thread-1", sender_type: "admin", body: "Seu atendimento foi atualizado." };
const props = { accessKey: "TEST-KEY", keyId: "key-1", chatOpen: false, onOpen: vi.fn() };

describe("avisos de suporte com usuário conectado", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    rpc.mockResolvedValue({ data: [reply], error: null });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  const mount = async (overrides = {}) => {
    await act(async () => { render(<SupportMessageNotice {...props} {...overrides} />); });
  };
  it("abre a conversa correspondente e não repete o aviso já aberto", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Ir para o chat de suporte" }));
    expect(props.onOpen).toHaveBeenCalledWith("thread-1");
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByRole("status")).toBeNull();
    expect(localStorage.getItem("atlas_support_seen:key-1")).toBe("reply-1");
  });
  it("não avisa quando o suporte está aberto", async () => {
    await mount({ chatOpen: true });
    expect(screen.queryByRole("status")).toBeNull();
    expect(localStorage.getItem("atlas_support_seen:key-1")).toBe("reply-1");
  });
  it("não consulta nem avisa em segundo plano e atualiza ao voltar", async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    await mount();
    expect(rpc).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(screen.getByRole("status")).toBeTruthy();
  });
  it("não notifica sobre mensagens do próprio usuário", async () => {
    rpc.mockResolvedValue({ data: [{ ...reply, sender_type: "user" }], error: null });
    await mount();
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("permite dispensar sem abrir e avisa sobre uma nova resposta", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Dispensar aviso do suporte" }));
    expect(props.onOpen).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: [{ ...reply, id: "reply-2" }], error: null });
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByRole("status")).toBeTruthy();
  });
});