import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/pages/Login";
import AdminLoginPage from "@/pages/AdminLogin";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), redeem: vi.fn(), keyData: null as null | { key: string } }));
vi.mock("@/lib/admin-context", () => ({ useAdmin: () => ({ password: null, loading: false, signIn: mocks.signIn }) }));
vi.mock("@/lib/key-context", () => ({ useKey: () => ({ keyData: mocks.keyData, expiredKey: null, loading: false, redeem: mocks.redeem }) }));
vi.mock("@/components/atlas/SupportChat", () => ({ SupportChat: () => null }));
vi.mock("@/components/atlas/NotificationBell", () => ({ NotificationBell: () => null }));

beforeEach(() => { vi.clearAllMocks(); mocks.keyData = null; mocks.signIn.mockResolvedValue(true); mocks.redeem.mockResolvedValue({ ok: true }); });
afterEach(cleanup);
function open(path: string) {
  return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<div>Painel ADM autenticado</div>} />
      <Route path="/painel" element={<div>Painel usuário autenticado</div>} />
    </Routes>
  </MemoryRouter>);
}

describe("logins separados", () => {
  it("login de usuário valida só a key, nunca tenta senha de ADM", async () => {
    open("/login");
    fireEvent.change(screen.getByPlaceholderText("XXXX-XXXX-XXXX"), { target: { value: "key-a" } });
    fireEvent.submit(screen.getByRole("form", { name: "Formulário de chave de acesso" }));
    await screen.findByText("Painel usuário autenticado");
    expect(mocks.redeem).toHaveBeenCalledWith("KEY-A");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("login de ADM preserva maiúsculas/minúsculas e não usa redeem", async () => {
    open("/admin/login");
    fireEvent.change(screen.getByLabelText("Chave ou senha do ADM"), { target: { value: "MinhaSenhaAdm" } });
    fireEvent.submit(screen.getByRole("form", { name: "Login de administrador" }));
    await screen.findByText("Painel ADM autenticado");
    expect(mocks.signIn).toHaveBeenCalledWith("MinhaSenhaAdm");
    expect(mocks.redeem).not.toHaveBeenCalled();
  });

  it("senha ADM inválida mantém o formulário e não libera painel", async () => {
    mocks.signIn.mockResolvedValue(false);
    open("/admin/login");
    fireEvent.change(screen.getByLabelText("Chave ou senha do ADM"), { target: { value: "senha-invalida" } });
    fireEvent.submit(screen.getByRole("form", { name: "Login de administrador" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Painel ADM autenticado")).not.toBeInTheDocument();
  });

  it("acesso de usuário já aberto não impede entrar como ADM", () => {
    mocks.keyData = { key: "KEY-A" };
    open("/admin/login");
    expect(screen.getByRole("form", { name: "Login de administrador" })).toBeVisible();
  });

  it("trocar usuário abre o formulário sem ser redirecionado pela key anterior", async () => {
    mocks.keyData = { key: "KEY-A" };
    open("/login?trocar=1");
    await waitFor(() => expect(screen.getByRole("form", { name: "Formulário de chave de acesso" })).toBeVisible());
    expect(screen.queryByText("Painel usuário autenticado")).not.toBeInTheDocument();
  });

  it("indica o acesso ADM separado quando uma chave é recusada no login de usuário", async () => {
    mocks.redeem.mockResolvedValue({ ok: false, error: "invalid_key" });
    open("/login");
    fireEvent.change(screen.getByPlaceholderText("XXXX-XXXX-XXXX"), { target: { value: "acesso-antigo" } });
    fireEvent.submit(screen.getByRole("form", { name: "Formulário de chave de acesso" }));
    await screen.findByText(/Se esta é sua chave de administrador/);
    fireEvent.click(screen.getByRole("link", { name: "Entrar como ADM" }));
    expect(screen.getByRole("form", { name: "Login de administrador" })).toBeVisible();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("falha do serviço mostra erro de validação sem dizer que a chave é inválida", async () => {
    mocks.signIn.mockRejectedValue(new Error("admin_validation_unavailable"));
    open("/admin/login");
    fireEvent.change(screen.getByLabelText("Chave ou senha do ADM"), { target: { value: "acesso-adm" } });
    fireEvent.submit(screen.getByRole("form", { name: "Login de administrador" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível confirmar seu acesso ADM");
    expect(alert).not.toHaveTextContent("ADM inválida");
    expect(screen.queryByText("Painel ADM autenticado")).not.toBeInTheDocument();
  });
});
