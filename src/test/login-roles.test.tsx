import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/pages/Login";
import AdminLoginPage from "@/pages/AdminLogin";

const mocks = vi.hoisted(() => ({ recognize: vi.fn(), signIn: vi.fn(), redeem: vi.fn(), keyData: null as null | { key: string } }));
vi.mock("@/lib/admin-context", () => ({ useAdmin: () => ({ password: null, loading: false, recognize: mocks.recognize, signIn: mocks.signIn }) }));
vi.mock("@/lib/key-context", () => ({ useKey: () => ({ keyData: mocks.keyData, expiredKey: null, loading: false, redeem: mocks.redeem }) }));
vi.mock("@/components/atlas/SupportChat", () => ({ SupportChat: () => null }));
vi.mock("@/components/atlas/NotificationBell", () => ({ NotificationBell: () => null }));

beforeEach(() => { vi.resetAllMocks(); mocks.keyData = null; mocks.recognize.mockResolvedValue(false); mocks.signIn.mockResolvedValue(true); mocks.redeem.mockResolvedValue({ ok: true }); });
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
  it("key de usuário não exibe botão ADM e não abre sessão administrativa", async () => {
    open("/login");
    fireEvent.change(screen.getByPlaceholderText("XXXX-XXXX-XXXX"), { target: { value: "key-a" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Entrar como ADM" })).not.toBeInTheDocument();
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

  it("uma chave inválida também não revela o botão ADM", async () => {
    mocks.redeem.mockResolvedValue({ ok: false, error: "invalid_key" });
    open("/login");
    fireEvent.change(screen.getByPlaceholderText("XXXX-XXXX-XXXX"), { target: { value: "acesso-antigo" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled());
    fireEvent.submit(screen.getByRole("form", { name: "Formulário de chave de acesso" }));
    await screen.findByText("Chave inválida. Verifique e tente novamente.");
    expect(screen.queryByText("Entrar como ADM")).not.toBeInTheDocument();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("não mostra acesso ADM antes de digitar e só abre a sessão ao clicar após reconhecimento", async () => {
    mocks.recognize.mockResolvedValue(true);
    open("/login");
    expect(screen.queryByText("Entrar como ADM")).not.toBeInTheDocument();
    expect(mocks.recognize).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText("XXXX-XXXX-XXXX"), { target: { value: "AdmTeste" } });
    const button = await screen.findByRole("button", { name: "Entrar como ADM" });
    expect(mocks.recognize).toHaveBeenCalledWith("AdmTeste");
    expect(mocks.signIn).not.toHaveBeenCalled();
    fireEvent.click(button);
    await screen.findByText("Painel ADM autenticado");
    expect(mocks.signIn).toHaveBeenCalledWith("AdmTeste");
    expect(mocks.redeem).not.toHaveBeenCalled();
  });

  it("esconde imediatamente o botão ADM ao trocar a senha por uma key de usuário", async () => {
    mocks.recognize.mockResolvedValueOnce(true).mockResolvedValue(false);
    open("/login");
    const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX");
    fireEvent.change(input, { target: { value: "AdmTeste" } });
    await screen.findByRole("button", { name: "Entrar como ADM" });
    fireEvent.change(input, { target: { value: "key-a" } });
    expect(screen.queryByText("Entrar como ADM")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled());
    expect(screen.queryByText("Entrar como ADM")).not.toBeInTheDocument();
  });

  it("ignora reconhecimento antigo que termina depois de o campo mudar", async () => {
    let finish: (admin: boolean) => void;
    mocks.recognize.mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve; }));
    open("/login");
    const input = screen.getByPlaceholderText("XXXX-XXXX-XXXX");
    fireEvent.change(input, { target: { value: "AdmTeste" } });
    await waitFor(() => expect(mocks.recognize).toHaveBeenCalledOnce());
    fireEvent.change(input, { target: { value: "key-a" } });
    finish!(true);
    await waitFor(() => expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled());
    expect(screen.queryByText("Entrar como ADM")).not.toBeInTheDocument();
  });

  it("falha no reconhecimento não revela botão ADM nem cria sessão", async () => {
    mocks.recognize.mockRejectedValue(new Error("offline"));
    open("/login");
    fireEvent.change(screen.getByPlaceholderText("XXXX-XXXX-XXXX"), { target: { value: "qualquer-entrada" } });
    await screen.findByRole("alert");
    expect(screen.queryByText("Entrar como ADM")).not.toBeInTheDocument();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("revalida o acesso ao clicar e não libera ADM se a senha deixar de ser aceita", async () => {
    mocks.recognize.mockResolvedValue(true);
    mocks.signIn.mockResolvedValue(false);
    open("/login");
    fireEvent.change(screen.getByPlaceholderText("XXXX-XXXX-XXXX"), { target: { value: "AdmTeste" } });
    fireEvent.click(await screen.findByRole("button", { name: "Entrar como ADM" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Painel ADM autenticado")).not.toBeInTheDocument();
    expect(mocks.redeem).not.toHaveBeenCalled();
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
