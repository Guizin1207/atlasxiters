import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { generateText } from "npm:ai";
type ChatTurn = { role: "user" | "assistant"; content: string };

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const body = await req.json().catch(() => null);
    const accessKey = typeof body?.key === "string" ? body.key.trim().toUpperCase() : "";
    const question = typeof body?.question === "string" ? body.question.trim().slice(0, 1200) : "";
    if (!accessKey) return json({ error: "Informe sua chave de acesso." }, 401);
    if (!question) return json({ error: "Digite uma mensagem para a Atlas IA." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!supabaseUrl || !serviceRole) return json({ error: "Backend não configurado." }, 500);
    if (!apiKey) return json({ error: "A IA ainda não está configurada neste projeto." }, 503);

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data: keyOk, error: keyError } = await admin.rpc("_valid_access_key", { _key: accessKey });
    if (keyError || keyOk !== true) return json({ error: "Chave inválida, revogada ou expirada." }, 403);

    const chat: ChatTurn[] = Array.isArray(body?.chat)
      ? body.chat.slice(-12).flatMap((item: unknown) => {
          if (!item || typeof item !== "object") return [];
          const turn = item as Record<string, unknown>;
          if (turn.role !== "user" && turn.role !== "assistant") return [];
          if (typeof turn.content !== "string") return [];
          const content = turn.content.trim().slice(0, 1200);
          return content ? [{ role: turn.role, content } as ChatTurn] : [];
        })
      : [];

    const device = typeof body?.device === "string" ? body.device.trim().slice(0, 100) : "";
    const plan = typeof body?.plan === "string" ? body.plan.trim().slice(0, 30) : "não informado";
    const style = typeof body?.style === "string" ? body.style.trim().slice(0, 40) : "não informado";
    const dpi = typeof body?.dpi === "string" || typeof body?.dpi === "number" ? String(body.dpi).slice(0, 20) : "não informado";

    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const result = await generateText({
      model: lovable.responses("openai/gpt-6-astra"),
      system: [
        "Você é a Atlas IA, assistente oficial do Atlas para jogadores de Free Fire.",
        "Fale sempre em português brasileiro, com tom amigável, direto, experiente e natural.",
        "Você é uma IA conversacional: responda perguntas abertas, mantenha o contexto e faça uma pergunta objetiva quando faltar informação.",
        "Especialidades: Free Fire, sensibilidade, DPI, botão de tiro, HUD, puxada de capa, mira, movimentação, treino, gráficos, FPS, aquecimento e desempenho Android/iOS.",
        "Ao sugerir sensibilidade, entregue números coerentes e explique que são ponto de partida para teste, não garantia de capa. Não invente especificações do aparelho.",
        "Diferencie Android de iPhone: não recomende alterar DPI no iOS.",
        "Para desempenho, priorize ajustes seguros e reversíveis. Não recomende APK modificado, cheats, macros, injetores, bypass ou ferramentas que coloquem a conta em risco.",
        "Não afirme que consegue alterar o celular, o jogo ou a conta diretamente. Não invente recursos, promoções ou regras do Atlas.",
        "Se a pergunta não for sobre Free Fire, responda brevemente e conduza de volta ao tema quando fizer sentido.",
        "Contexto informado pelo jogador: aparelho=" + (device || "não informado") + "; estilo=" + style + "; DPI=" + dpi + "; plano=" + plan + ".",
        "Respostas claras, organizadas e úteis. Evite respostas genéricas e não repita a saudação em todas as mensagens.",
      ].join("\n"),
      messages: [...chat, { role: "user", content: question }],
      maxOutputTokens: 700,
      temperature: 0.7,
    });

    const answer = result.text?.trim();
    if (!answer) return json({ error: "A Atlas IA não retornou uma resposta. Tente novamente." }, 502);
    return json({ answer: answer.slice(0, 5000) });
  } catch (error) {
    console.error("atlas-chat-ai error", error);
    return json({ error: "Não foi possível responder agora. Tente novamente em instantes." }, 500);
  }
});
