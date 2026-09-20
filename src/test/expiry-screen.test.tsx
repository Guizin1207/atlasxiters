import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import PainelPage from "@/pages/Painel";
import LoginPage from "@/pages/Login";

const mocks = vi.hoisted(() => ({ expiredKey: "KEY-A" as string | null, loading: false, messages: [] as unknown[] }));
vi.mock("@/lib/key-context", () => ({ useKey: () => ({ keyData: null, expiredKey: mocks.expiredKey, loading: mocks.loading, signOut: vi.fn(), redeem: vi.fn(), adminPreview: false }) }));
vi.mock("@/lib/admin-context", () => ({ useAdmin: () => ({ signIn: vi.fn() }) }));
vi.mock("@/hooks/use-maintenance", () => ({ useMaintenance: () => ({ enabled: false }) }));
vi.mock("@/hooks/use-messages", () => ({ useMessages: () => ({ messages: mocks.messages, unread: 0, loading: false, loadError: false, markAllRead: vi.fn(), reload: vi.fn() }) }));
vi.mock("@/components/atlas/SupportChat", () => ({ SupportChat: ({ accessKey }: { accessKey: string }) => <div data-testid="support-key">{accessKey}</div> }));
vi.mock("@/components/atlas/FuncoesTab", () => ({ FuncoesTab: () => <div>FUNÇÕES RESTRITAS</div> }));
vi.mock("@/components/atlas/AjustesTab", () => ({ AjustesTab: () => null }));
vi.mock("@/components/atlas/PerfilTab", () => ({ PerfilTab: () => null }));
vi.mock("@/components/atlas/InjectButton", () => ({ InjectButton: () => <button>INJETAR RESTRITO</button> }));
vi.mock("@/components/MaintenanceModal", () => ({ MaintenanceModal: () => null }));

beforeEach(() => {
  mocks.expiredKey = "KEY-A"; mocks.loading = false; mocks.messages = [];
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</MemoryRouter>;

describe("aviso vermelho sem liberar acesso expirado", () => {
  it("mostra a frase exata, mantém o sino e não monta funções restritas", () => {
    render(<PainelPage />, { wrapper });
    expect(screen.getByRole("heading", { name: "Sua key foi expirada" })).toHaveClass("text-status-danger");
    expect(screen.getByRole("button", { name: /Notificações/ })).toBeEnabled();
    expect(screen.queryByText("FUNÇÕES RESTRITAS")).not.toBeInTheDocument();
    expect(screen.queryByText("INJETAR RESTRITO")).not.toBeInTheDocument();
  });

  it("uma mensagem antiga lida não esconde a expiração atual no sino", () => {
    mocks.messages = [{ id: "old", title: "Sua key foi expirada", body: "Aviso antigo", created_at: "2026-01-01T00:00:00Z", is_read: true }];
    render(<PainelPage />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    const alert = within(screen.getByRole("dialog")).getByRole("alert");
    expect(alert).toHaveClass("border-status-danger/40", "bg-status-danger/10");
    expect(within(alert).getByText("Sua key foi expirada")).toHaveClass("text-status-danger");
  });

  it("o suporte recebe a key expirada, sem depender de keyData válido", () => {
    render(<PainelPage />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: "Falar com o suporte" }));
    expect(screen.getByTestId("support-key")).toHaveTextContent("KEY-A");
  });

  it("o login mostra a expiração quando a validação termina depois da montagem", () => {
    mocks.expiredKey = null; mocks.loading = true;
    const view = render(<LoginPage />, { wrapper });
    expect(screen.queryByText("Sua key foi expirada")).not.toBeInTheDocument();
    mocks.expiredKey = "KEY-A"; mocks.loading = false; view.rerender(<LoginPage />);
    expect(screen.getByRole("alert")).toHaveClass("text-status-danger");
    expect(screen.getByText("Sua key foi expirada")).toBeVisible();
  });
});
