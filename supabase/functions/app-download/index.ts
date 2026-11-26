// Arquivo TXT necessário para a injeção. O bucket é privado: somente esta
// função cria links temporários depois de validar o ADM ou a chave do usuário.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const BUCKET = "app-downloads";
const BodySchema = z.object({
  action: z.enum(["upload-url", "download-url", "delete"]),
  password: z.string().optional(),
  key: z.string().optional(),
  path: z.string().optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isValidPath = (path: string) =>
  /^injection\/[a-zA-Z0-9._-]+\.txt$/.test(path) && !path.includes("..");

type DownloadConfig = {
  path?: string;
  file_name?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return json({ error: "Configuração do backend ausente." }, 500);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return json({ error: "Parâmetros inválidos." }, 400);

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
      if (!isAdmin) return json({ error: "Apenas o administrador pode substituir o arquivo." }, 403);
      const objectPath = `injection/${Date.now()}-${crypto.randomUUID()}.txt`;
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(objectPath);
      if (error || !data) return json({ error: "Não foi possível preparar o envio do arquivo." }, 500);
      return json({ path: objectPath, token: data.token });
    }

    const { data: currentData, error: currentError } = await admin.rpc("get_download_file");
    if (currentError) return json({ error: "Não foi possível localizar o arquivo atual." }, 500);
    const current = (currentData ?? {}) as DownloadConfig;

    if (action === "delete") {
      if (!isAdmin) return json({ error: "Apenas o administrador pode remover arquivos." }, 403);
      if (!isValidPath(path)) return json({ error: "Caminho de arquivo inválido." }, 400);
      if (current.path === path) return json({ error: "O arquivo ativo não pode ser removido." }, 409);
      const { error } = await admin.storage.from(BUCKET).remove([path]);
      if (error) return json({ error: "Não foi possível remover o arquivo anterior." }, 500);
      return json({ ok: true });
    }

    if (!isAdmin) {
      if (!key) return json({ error: "Chave de acesso obrigatória." }, 401);
      const { data } = await admin.rpc("_valid_access_key", { _key: key });
      if (data !== true) return json({ error: "Chave inválida ou expirada." }, 403);
    }
    if (!current.path || !isValidPath(current.path)) {
      return json({ error: "Nenhum arquivo enviado pelo administrador." }, 404);
    }

    // O caminho sempre vem da configuração atual, nunca do navegador. Assim,
    // um link antigo não consegue selecionar uma versão diferente do arquivo.
    const fileName = current.file_name || "atlas-config.txt";
    const { data, error } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(current.path, 5 * 60, { download: fileName });
    if (error || !data) return json({ error: "Não foi possível preparar o download." }, 500);
    return json({ url: data.signedUrl, fileName, path: current.path });
  } catch (error) {
    console.error("app-download error", error);
    return json({ error: "Falha ao processar o arquivo de download." }, 500);
  }
});
