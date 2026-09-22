// Acesso aos comprovantes do suporte. O bucket é privado e sem políticas públicas:
// somente esta função (com a service role) gera links temporários, depois de
// validar a chave do usuário ou a senha do administrador.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "support-receipts";
const EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const safePrefix = (key: string) => key.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 48);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Configuração do backend ausente." }, 500);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : "";
    const key = typeof body?.key === "string" ? body.key.trim().toUpperCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const path = typeof body?.path === "string" ? body.path.trim() : "";

    let isAdmin = false;
    if (password) {
      const { data } = await admin.rpc("_check_admin", { _password: password });
      isAdmin = data === true;
      if (!isAdmin) return json({ error: "Senha de administrador inválida." }, 403);
    }

    let keyValid = false;
    if (!isAdmin) {
      if (!key) return json({ error: "Informe sua chave de acesso." }, 401);
      const { data } = await admin.rpc("_valid_access_key", { _key: key });
      keyValid = data === true;
      if (!keyValid) return json({ error: "Chave inválida ou expirada." }, 403);
    }

    if (action === "upload-url") {
      if (isAdmin) return json({ error: "Envio de comprovante é do usuário." }, 400);
      const ext = EXTENSIONS.includes(String(body?.ext ?? "").toLowerCase())
        ? String(body.ext).toLowerCase()
        : "jpg";
      const objectPath = `${safePrefix(key)}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(objectPath);
      if (error || !data) return json({ error: "Não foi possível preparar o envio." }, 500);
      return json({ path: objectPath, token: data.token });
    }

    if (action === "view-url") {
      if (!path || path.includes("..")) return json({ error: "Comprovante inválido." }, 400);
      // O usuário só abre comprovantes da própria chave; o ADM abre qualquer um.
      if (!isAdmin && !path.startsWith(`${safePrefix(key)}/`)) {
        return json({ error: "Comprovante de outra conta." }, 403);
      }
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
      if (error || !data) return json({ error: "Não foi possível abrir o comprovante." }, 500);
      return json({ url: data.signedUrl });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("support-receipt error", error);
    return json({ error: "Falha ao processar o comprovante." }, 500);
  }
});
