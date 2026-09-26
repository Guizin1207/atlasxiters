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

  let body: { key?: unknown; name?: unknown; password?: unknown; device?: unknown; device_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const key = typeof body.key === "string" ? body.key.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const device = typeof body.device === "string" ? body.device.slice(0, 40) : null;
  const deviceId = typeof body.device_id === "string" && /^[0-9a-f-]{36}$/i.test(body.device_id) ? body.device_id : null;

  if (!key || key.length > 64) return json({ ok: false, error: "invalid_key" }, 400);
  if (name.length < 2 || name.length > 40) return json({ ok: false, error: "invalid_username" }, 400);
  if (
    password.length < 8 ||
    password.length > 72 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    return json({ ok: false, error: "weak_password" }, 400);
  }

  const { data: rec, error: keyErr } = await db
    .from("access_keys")
    .select("id, revoked, is_master, user_id, expires_at, duration_days")
    .eq("key", key)
    .maybeSingle();

  if (keyErr) return json({ ok: false, error: "database_error" }, 500);
  if (!rec || rec.revoked || rec.is_master) return json({ ok: false, error: "invalid_key" }, 400);
  if (rec.expires_at && new Date(rec.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: "invalid_key" }, 400);
  }
  if (rec.user_id) return json({ ok: false, error: "key_already_linked" }, 409);

  const email = `${key.replace(/[^A-Z0-9]/g, "")}@atlasvip.app`.toLowerCase();
  const attrs = {
    password,
    email_confirm: true,
    user_metadata: { full_name: name, name },
  };

  const errCode = (message: string) => {
    const lower = message.toLowerCase();
    return lower.includes("weak") || lower.includes("password") ? "leaked_password" : "signup_failed";
  };

  let uid: string;
  let createdNow = false;

  const { data: created, error: createErr } = await db.auth.admin.createUser({ email, ...attrs });

  if (created?.user) {
    uid = created.user.id;
    createdNow = true;
  } else {
    const message = createErr?.message ?? "";
    console.error("createUser", message);

    if (!message.toLowerCase().includes("already")) {
      return json({ ok: false, error: errCode(message) }, 400);
    }

    // Retry seguro: se a conta já existe para esta key, reutiliza a mesma conta.
    let found: { id: string; email?: string | null } | null = null;
    for (let page = 1; page <= 20 && !found; page++) {
      const { data: list } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (!list?.users.length) break;
      const user = list.users.find((item) => item.email?.toLowerCase() === email);
      if (user) found = { id: user.id, email: user.email };
    }

    if (!found) return json({ ok: false, error: "account_already_exists" }, 409);

    uid = found.id;
    const { data: existingProfile } = await db
      .from("profiles")
      .select("id, full_name")
      .eq("id", uid)
      .maybeSingle();

    // Se a conta existente pertence a outro usuário, não sobrescreve.
    if (existingProfile?.full_name && existingProfile.full_name.trim().toLowerCase() !== name.toLowerCase()) {
      return json({ ok: false, error: "account_already_exists" }, 409);
    }

    const { error: updErr } = await db.auth.admin.updateUserById(uid, attrs);
    if (updErr) return json({ ok: false, error: errCode(updErr.message) }, 400);
  }

  // Impede dois usuários diferentes de usarem o mesmo nome.
  const { data: sameName } = await db
    .from("profiles")
    .select("id, full_name")
    .ilike("full_name", name.replace(/[%_\\]/g, "\\\\$&"))
    .limit(10);

  const anotherProfile = (sameName ?? []).find((profile) => profile.id !== uid);
  if (anotherProfile) {
    if (createdNow) await db.auth.admin.deleteUser(uid);
    return json({ ok: false, error: "username_taken" }, 409);
  }

  const { error: profErr } = await db
    .from("profiles")
    .upsert({ id: uid, full_name: name, updated_at: new Date().toISOString() });

  if (profErr) {
    if (createdNow) await db.auth.admin.deleteUser(uid);
    return json({ ok: false, error: "profile_creation_failed" }, 500);
  }

  const activation = new Date();
  const expiresAt = rec.duration_days
    ? new Date(activation.getTime() + rec.duration_days * 24 * 60 * 60 * 1000).toISOString()
    : rec.expires_at;

  const { data: bound, error: bindErr } = await db
    .from("access_keys")
    .update({
      user_id: uid,
      activated_at: activation.toISOString(),
      expires_at: expiresAt,
      device,
      device_id: deviceId,
    })
    .eq("id", rec.id)
    .is("user_id", null)
    .select("id");

  if (bindErr || !bound?.length) {
    if (createdNow) await db.auth.admin.deleteUser(uid);
    return json({ ok: false, error: bindErr ? "database_error" : "key_already_linked" }, 409);
  }

  // Confirma no banco antes de responder sucesso.
  const [{ data: authUser }, { data: prof }, { data: linked }] = await Promise.all([
    db.auth.admin.getUserById(uid),
    db.from("profiles").select("id").eq("id", uid).maybeSingle(),
    db.from("access_keys").select("id, activated_at").eq("id", rec.id).eq("user_id", uid).maybeSingle(),
  ]);
  if (!authUser?.user || !prof || !linked?.activated_at) {
    await db.from("access_keys").update({ user_id: null, activated_at: null, expires_at: rec.expires_at, device: null, device_id: null }).eq("id", rec.id);
    if (createdNow) await db.auth.admin.deleteUser(uid);
    return json({ ok: false, error: "signup_failed" }, 500);
  }

  return json({ ok: true, email });
});
