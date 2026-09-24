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

  let body: { key?: unknown; name?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return json({ ok: false, error: "invalid_request" }, 400); }
  const key = typeof body.key === "string" ? body.key.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!key || key.length > 64) return json({ ok: false, error: "invalid_key" }, 400);
  if (name.length < 2 || name.length > 40) return json({ ok: false, error: "invalid_username" }, 400);
  if (password.length < 8 || password.length > 72 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password))
    return json({ ok: false, error: "weak_password" }, 400);

  const { data: rec, error: keyErr } = await db.from("access_keys")
    .select("id, revoked, is_master, user_id, expires_at").eq("key", key).maybeSingle();
  if (keyErr) return json({ ok: false, error: "database_error" }, 500);
  if (!rec || rec.revoked || rec.is_master) return json({ ok: false, error: "invalid_key" }, 400);
  if (rec.expires_at && new Date(rec.expires_at).getTime() < Date.now()) return json({ ok: false, error: "invalid_key" }, 400);
  if (rec.user_id) return json({ ok: false, error: "key_already_linked" }, 409);

  const { data: taken } = await db.from("profiles").select("id").ilike("full_name", name.replace(/[%_\\]/g, "\\$&")).limit(1);
  if (taken && taken.length) return json({ ok: false, error: "username_taken" }, 409);

  const email = `${key.replace(/[^A-Z0-9]/g, "")}@atlasvip.app`.toLowerCase();
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: name, name },
  });
  if (createErr || !created.user) {
    console.error("createUser", createErr?.message);
    const msg = (createErr?.message ?? "").toLowerCase();
    return json({ ok: false, error: msg.includes("already") ? "account_already_exists" : "signup_failed" }, 400);
  }
  const uid = created.user.id;

  const { error: profErr } = await db.from("profiles").upsert({ id: uid, full_name: name, updated_at: new Date().toISOString() });
  if (profErr) { await db.auth.admin.deleteUser(uid); return json({ ok: false, error: "profile_creation_failed" }, 500); }

  // Vínculo atômico: só grava se ninguém vinculou a key nesse meio tempo.
  const { data: bound, error: bindErr } = await db.from("access_keys")
    .update({ user_id: uid }).eq("id", rec.id).is("user_id", null).select("id");
  if (bindErr || !bound?.length) {
    await db.auth.admin.deleteUser(uid);
    return json({ ok: false, error: bindErr ? "database_error" : "key_already_linked" }, 409);
  }
  return json({ ok: true, email });
});
