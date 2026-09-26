import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "invalid_request" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ ok: false, error: "server_configuration_error" }, 500);
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: { admin_password?: unknown; user_id?: unknown; new_password?: unknown };
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid_request" }, 400); }
  const adminPassword = typeof body.admin_password === "string" ? body.admin_password : "";
  const userId = typeof body.user_id === "string" && /^[0-9a-f-]{36}$/i.test(body.user_id) ? body.user_id : "";
  const pwd = typeof body.new_password === "string" ? body.new_password : "";
  if (!adminPassword || !userId) return json({ ok: false, error: "invalid_request" }, 400);
  if (pwd.length < 8 || pwd.length > 72 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/\d/.test(pwd)) {
    return json({ ok: false, error: "weak_password" }, 400);
  }

  const { data: isAdmin } = await db.rpc("_check_admin", { _password: adminPassword });
  if (isAdmin !== true) return json({ ok: false, error: "unauthorized" }, 403);

  const { data, error } = await db.auth.admin.updateUserById(userId, { password: pwd });
  if (error || !data?.user) {
    const m = (error?.message ?? "").toLowerCase();
    return json({ ok: false, error: m.includes("weak") || m.includes("pwned") ? "leaked_password" : "update_failed" }, 400);
  }
  return json({ ok: true });
});
