type Result = { data?: any; error?: { message: string } | null };
type Dependencies = {
  db: {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<Result>;
    from: (name: string) => any;
    auth: { admin: { updateUserById: (id: string, attrs: Record<string, unknown>) => Promise<Result>; deleteUser: (id: string) => Promise<Result> } };
  };
  corsHeaders: Record<string, string>;
};

export function createAccountHandler({ db, corsHeaders }: Dependencies) {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ ok: false, error: "invalid_request" }, 405);
    try {
      const body = await req.json();
      const password = typeof body.admin_password === "string" ? body.admin_password : "";
      const userId = typeof body.user_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.user_id) ? body.user_id : "";
      if (!password || !userId) return json({ ok: false, error: "invalid_request" }, 400);
      const { data: authorized, error: authError } = await db.rpc("_check_admin", { _password: password });
      if (authError || authorized !== true) return json({ ok: false, error: "unauthorized" }, 403);
      const action = body.action ?? "password";
      if (!["block", "unblock", "delete", "password"].includes(action)) return json({ ok: false, error: "invalid_request" }, 400);
      if (action === "block" || action === "unblock") {
        // Key revocation is the central access barrier and sends the existing push notice.
        const { error } = await db.rpc("admin_set_account_block", { _password: password, _user_id: userId, _blocked: action === "block" });
        if (error) return json({ ok: false, error: error.message.includes("protected_account") ? "protected_account" : "update_failed" }, 400);
        return json({ ok: true });
      }
      if (action === "delete") {
        const { data: keys, error: keyError } = await db.from("access_keys").select("id,is_master,revoked").eq("user_id", userId);
        if (keyError) return json({ ok: false, error: "delete_failed" }, 400);
        if ((keys ?? []).some((key: { is_master: boolean }) => key.is_master)) return json({ ok: false, error: "protected_account" }, 403);
        const { data: profile, error: profileError } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
        if (profileError) return json({ ok: false, error: "delete_failed" }, 400);
        // Revoke before detaching: old sessions and copied keys cannot retain access.
        const { error: detachError } = await db.from("access_keys").update({ revoked: true, user_id: null, device_id: null, device: null }).eq("user_id", userId);
        if (detachError) return json({ ok: false, error: "delete_failed" }, 400);
        const { error: removeProfileError } = await db.from("profiles").delete().eq("id", userId);
        const { error: deleteError } = removeProfileError ? { error: removeProfileError } : await db.auth.admin.deleteUser(userId);
        if (deleteError) {
          // Restore ownership but keep keys revoked when deletion cannot finish.
          if (keys?.length) await db.from("access_keys").update({ user_id: userId }).in("id", keys.map((key: { id: string }) => key.id));
          if (profile) await db.from("profiles").upsert(profile);
          return json({ ok: false, error: "delete_failed_access_revoked" }, 400);
        }
        const { error: cleanupError } = await db.from("account_blocks").delete().eq("user_id", userId);
        if (cleanupError) return json({ ok: true, warning: "Conta excluída; não foi possível limpar o registro de bloqueio." });
        return json({ ok: true });
      }
      const pwd = typeof body.new_password === "string" ? body.new_password : "";
      if (pwd.length < 8 || pwd.length > 72 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/\d/.test(pwd)) return json({ ok: false, error: "weak_password" }, 400);
      const { data, error } = await db.auth.admin.updateUserById(userId, { password: pwd });
      if (error || !data?.user) return json({ ok: false, error: /weak|pwned/i.test(error?.message ?? "") ? "leaked_password" : "update_failed" }, 400);
      return json({ ok: true });
    } catch {
      return json({ ok: false, error: "invalid_request" }, 400);
    }
  };
}