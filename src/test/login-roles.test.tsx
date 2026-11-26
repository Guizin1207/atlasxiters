import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/pages/Login";
import AdminLoginPage from "@/pages/AdminLogin";

const mocks = vi.hoisted(() => ({
  adminSignIn: vi.fn(),
  authSignIn: vi.fn(),
  redeem: vi.fn(),
  keyData: null as null | { key: string },
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    session: null,
    user: null,
    profile: null,
    loading: false,
    signIn: mocks.authSignIn,
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));
vi.mock("@/lib/admin-context", () => ({
  useAdmin: () => ({ password: null, loading: false, signIn: mocks.adminSignIn }),
}));
vi.mock("@/lib/key-context", () => ({
  AUTH_ERROR_KEY: "atlas_vip_auth_error",
  useKey: () => ({ keyData: mocks.keyData, expiredKey: null, loading: false, redeem: mocks.redeem }),
}));
vi.mock("@/components/atlas/SupportChat", () => ({ SupportChat: () => null }));
vi.mock("@/components/atlas/NotificationBell", () => ({ NotificationBell: () => null }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.keyData = null;
  mocks.adminSignIn.mockResolvedValue(true);
  mocks.authSignIn.mockResolvedValue({ error: null });
  mocks.redeem.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

function AdminDestination() {
  const location = useLocation();
  return <div data-testid="admin-destination">Painel ADM autenticado{location.search}</div>;
}

function open(path: string | { pathname: string; state: { from: string } }) {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminDestination />} />
      <Route path="/painel" element={<div>Painel usuário autenticado</div>} />
    </Routes>
  </MemoryRouter>);
}

function submitUserAccess() {
  const form = screen.getByLabelText("Senha").closest("form");
  if (!form) throw new Error("Formulário de acesso ausente");
  fireEvent.submit(form);
}

describe("acessos de usuário e ADM", () => {
  it("key universal entra no painel do usuário quando não é credencial ADM", async () => {
    mocks.adminSignIn.mockResolvedValue(false);
    open("/login");
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "ATLS-AAAA-BBBB" } });
    submitUserAccess();
    await screen.findByText("Painel usuário autenticado");
    expect(mocks.redeem).toHaveBeenCalledWith("ATLS-AAAA-BBBB");
    expect(mocks.authSignIn).not.toHaveBeenCalled();
  });

  it("key inválida mantém o usuário no login e mostra o motivo", async () => {
    mocks.adminSignIn.mockResolvedValue(false);
    mocks.redeem.mockResolvedValue({ ok: false, error: "invalid_key" });
    open("/login");
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "ATLS-AAAA-BBBB" } });
    submitUserAccess();
    await screen.findByText("Chave inválida. Verifique e tente novamente.");
    expect(screen.queryByText("Painel usuário autenticado")).not.toBeInTheDocument();
  });

  it("usuário e senha normais usam o login da conta", async () => {
    mocks.adminSignIn.mockResolvedValue(false);
    open("/login");
    fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: "cliente" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "Senha123" } });
    submitUserAccess();
    await screen.findByText("Painel usuário autenticado");
    expect(mocks.authSignIn).toHaveBeenCalledWith("cliente", "Senha123");
    expect(mocks.redeem).not.toHaveBeenCalled();
  });

  it("login de ADM preserva maiúsculas/minúsculas e não usa redeem", async () => {
    open("/admin/login");
    fireEvent.change(screen.getByLabelText("Chave ou senha do ADM"), { target: { value: "MinhaSenhaAdm" } });
    fireEvent.submit(screen.getByRole("form", { name: "Login de administrador" }));
    await screen.findByText("Painel ADM autenticado");
    expect(mocks.adminSignIn).toHaveBeenCalledWith("MinhaSenhaAdm");
    expect(mocks.redeem).not.toHaveBeenCalled();
  });

  it("após entrar, retorna à conversa indicada pela notificação", async () => {
    open({ pathname: "/admin/login", state: { from: "/admin?tab=support&thread=thread-a" } });
    fireEvent.change(screen.getByLabelText("Chave ou senha do ADM"), { target: { value: "MinhaSenhaAdm" } });
    fireEvent.submit(screen.getByRole("form", { name: "Login de administrador" }));
    const destination = await screen.findByTestId("admin-destination");
    expect(destination).toHaveTextContent("?tab=support&thread=thread-a");
  });

  it("senha ADM inválida mantém o formulário e não libera painel", async () => {
    mocks.adminSignIn.mockResolvedValue(false);
    open("/admin/login");
    fireEvent.change(screen.getByLabelText("Chave ou senha do ADM"), { target: { value: "senha-invalida" } });
    fireEvent.submit(screen.getByRole("form", { name: "Login de administrador" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Painel ADM autenticado")).not.toBeInTheDocument();
  });

  it("falha do serviço mostra erro de validação sem dizer que a senha é inválida", async () => {
    mocks.adminSignIn.mockRejectedValue(new Error("admin_validation_unavailable"));
    open("/admin/login");
    fireEvent.change(screen.getByLabelText("Chave ou senha do ADM"), { target: { value: "acesso-adm" } });
    fireEvent.submit(screen.getByRole("form", { name: "Login de administrador" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível confirmar seu acesso ADM");
    expect(alert).not.toHaveTextContent("ADM inválida");
  });
});
