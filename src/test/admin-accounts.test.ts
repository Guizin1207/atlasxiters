// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createAccountHandler } from "../../supabase/functions/admin-reset-password/handler";

const userId = "b9f700c4-d87e-43da-8295-98196b985640";
function fixture(options: { authorized?: boolean; master?: boolean; deleteFails?: boolean; detachFails?: boolean; blockFails?: boolean } = {}) {
  const events: Array<{ table: string; operation: string; value?: unknown }> = [];
  const rpc = vi.fn(async (name: string) => ({ data: name === "_check_admin" ? options.authorized !== false : true, error: name === "admin_set_account_block" && options.blockFails ? { message: "protected_account" } : null }));
  const from = (table: string) => {
    let operation = "select";
    const query = {
      select() { return query; },
      eq() { return query; },
      in() { return query; },
      update(value: unknown) { operation = "update"; events.push({ table, operation, value }); return query; },
      delete() { operation = "delete"; events.push({ table, operation }); return query; },
      upsert(value: unknown) { operation = "upsert"; events.push({ table, operation, value }); return query; },
      maybeSingle() { return Promise.resolve({ data: { id: userId, full_name: "Cliente" }, error: null }); },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: table === "access_keys" ? [{ id: "key-a", is_master: options.master ?? false, revoked: false }] : null, error: options.detachFails && table === "access_keys" && operation === "update" ? { message: "write failed" } : null }).then(resolve); },
    };
    return query;
  };
  const deleteUser = vi.fn(async () => { events.push({ table: "auth", operation: "delete" }); return { data: null, error: options.deleteFails ? { message: "failed" } : null }; });
  const updateUserById = vi.fn(async () => ({ data: { user: { id: userId } }, error: null }));
  const handler = createAccountHandler({ db: { rpc, from, auth: { admin: { deleteUser, updateUserById } } }, corsHeaders: { "Access-Control-Allow-Origin": "*" } });
  const send = (action: string, extra = {}) => handler(new Request("https://app.test/accounts", { method: "POST", body: JSON.stringify({ action, user_id: userId, admin_password: "test-credential", ...extra }) }));
  return { send, rpc, events, deleteUser, updateUserById };
}

describe("controles de contas ADM", () => {
  it.each(["block", "unblock", "delete", "password"])("recusa %s sem validação administrativa", async action => {
    const f = fixture({ authorized: false });
    expect((await f.send(action)).status).toBe(403);
    expect(f.events).toEqual([]);
    expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(f.deleteUser).not.toHaveBeenCalled();
    expect(f.updateUserById).not.toHaveBeenCalled();
  });
  it("bloqueia pela função central de revogação", async () => {
    const f = fixture();
    expect((await f.send("block")).status).toBe(200);
    expect(f.rpc).toHaveBeenLastCalledWith("admin_set_account_block", { _password: "test-credential", _user_id: userId, _blocked: true });
  });
  it("libera usando a restauração das keys no servidor", async () => {
    const f = fixture();
    expect((await f.send("unblock")).status).toBe(200);
    expect(f.rpc).toHaveBeenLastCalledWith("admin_set_account_block", { _password: "test-credential", _user_id: userId, _blocked: false });
  });
  it("não bloqueia conta protegida", async () => {
    const f = fixture({ blockFails: true });
    const response = await f.send("block");
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("protected_account");
  });
  it("nunca exclui conta com key mestra", async () => {
    const f = fixture({ master: true });
    expect((await f.send("delete")).status).toBe(403);
    expect(f.events).toEqual([]);
    expect(f.deleteUser).not.toHaveBeenCalled();
  });
  it("revoga as keys antes de excluir a conta", async () => {
    const f = fixture();
    expect((await f.send("delete")).status).toBe(200);
    expect(f.events[0]).toEqual({ table: "access_keys", operation: "update", value: { revoked: true, user_id: null, device_id: null, device: null } });
    expect(f.events.findIndex(event => event.table === "auth")).toBeGreaterThan(0);
    expect(f.deleteUser).toHaveBeenCalledWith(userId);
  });
  it("interrompe exclusão se não conseguir revogar o acesso", async () => {
    const f = fixture({ detachFails: true });
    expect((await f.send("delete")).status).toBe(400);
    expect(f.deleteUser).not.toHaveBeenCalled();
  });
  it("preserva conta e keys revogadas quando exclusão falha", async () => {
    const f = fixture({ deleteFails: true });
    const response = await f.send("delete");
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("delete_failed_access_revoked");
    expect(f.events).toContainEqual({ table: "access_keys", operation: "update", value: { user_id: userId } });
    expect(f.events).toContainEqual({ table: "profiles", operation: "upsert", value: { id: userId, full_name: "Cliente" } });
    expect(f.events.some(event => (event.value as { revoked?: boolean })?.revoked === false)).toBe(false);
  });
  it("rejeita IDs malformados antes de consultar o servidor", async () => {
    const f = fixture();
    expect((await f.send("block", { user_id: "invalid" })).status).toBe(400);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("mantém a validação de senha forte", async () => {
    const f = fixture();
    expect((await f.send("password", { new_password: "weak" })).status).toBe(400);
    expect(f.updateUserById).not.toHaveBeenCalled();
  });
});