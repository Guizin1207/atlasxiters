// Mídia da seção "Sobre o Painel". Bucket privado sem políticas públicas:
// somente esta função gera links assinados após validar senha do ADM ou chave do usuário.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const BUCKET = "panel-media";
const EXTENSIONS = ["mp4", "webm", "mov", "ogg"] as const;

const BodySchema = z.object({
  action: z.enum(["upload-url", "view-url", "delete"]),
  password: z.string().optional(),
  key: z.string().optional(),
  ext: z.string().optional(),
  path: z.string().optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isValidAboutPath = (path: string) =>
  /^about\/[a-zA-Z0-9._-]+$/.test(path) && !path.includes("..");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Configuração do backend ausente." }, 500);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "Parâmetros inválidos.", details: parsed.error.flatten().fieldErrors }, 400);
    }

    const { action } = parsed.data;
    const password = (parsed.data.password ?? "").trim();
    const key = (parsed.data.key ?? "").trim().toUpperCase();
    const path = (parsed.data.path ?? "").trim();

    let isAdmin = false;
    if (password) {
      const { data } = await admin.rpc("_check_admin", { _password: password });
      isAdmin = data === true;
      if (!isAdmin) return json({ error: "Senha administrativa inválida." }, 403);
    }

    if (action === "upload-url") {
      if (!isAdmin) return json({ error: "Apenas o administrador pode enviar vídeos." }, 403);
      const rawExt = (parsed.data.ext ?? "").toLowerCase();
      const ext = (EXTENSIONS as readonly string[]).includes(rawExt) ? rawExt : "mp4";
      const objectPath = `about/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(objectPath);
      if (error || !data) return json({ error: "Não foi possível preparar o envio do vídeo." }, 500);
      return json({ path: objectPath, token: data.token });
    }

    if (action === "delete") {
      if (!isAdmin) return json({ error: "Apenas o administrador pode remover vídeos." }, 403);
      if (!isValidAboutPath(path)) return json({ error: "Caminho de vídeo inválido." }, 400);
      const { error } = await admin.storage.from(BUCKET).remove([path]);
      if (error) return json({ error: "Não foi possível remover o vídeo." }, 500);
      return json({ ok: true });
    }

    if (action === "view-url") {
      if (!isAdmin) {
        if (!key) return json({ error: "Chave de acesso obrigatória." }, 401);
        const { data } = await admin.rpc("_valid_access_key", { _key: key });
        if (data !== true) return json({ error: "Chave inválida ou expirada." }, 403);
      }
      if (!isValidAboutPath(path)) return json({ error: "Caminho de vídeo inválido." }, 400);
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
      if (error || !data) return json({ error: "Não foi possível carregar o vídeo." }, 500);
      return json({ url: data.signedUrl });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("panel-media error", error);
    return json({ error: "Falha ao processar mídia do painel." }, 500);
  }
});