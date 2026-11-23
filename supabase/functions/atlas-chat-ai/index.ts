import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const question = typeof body?.question === "string" ? body.question.trim().slice(0, 1000) : "";
    if (!accessKey) return json({ error: "Informe sua chave de acesso." }, 401);
    if (!question) return json({ error: "Digite uma mensagem para a Atlas IA." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!supabaseUrl || !serviceRole) return json({ error: "Backend não configurado." }, 500);
    if (!apiKey) return json({ error: "A IA ainda não está configurada neste projeto. Configure LOVABLE_API_KEY nos secrets." }, 503);

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data: keyOk, error: keyError } = await admin.rpc("_valid_access_key", { _key: accessKey });
    if (keyError) {
      console.error("atlas-chat-ai key validation failed", keyError.message);
      return json({ error: "Não foi possível validar sua chave. Tente novamente mais tarde." }, 503);
    }
    if (keyOk !== true) return json({ error: "Chave inválida, revogada ou expirada." }, 403);

    const chat: ChatTurn[] = Array.isArray(body?.chat)
      ? body.chat.slice(-8).flatMap((item: unknown) => {
          if (!item || typeof item !== "object") return [];
          const turn = item as Record<string, unknown>;
          if (turn.role !== "user" && turn.role !== "assistant") return [];
          if (typeof turn.content !== "string") return [];
          const content = turn.content.trim().slice(0, 700);
          return content ? [{ role: turn.role, content } as ChatTurn] : [];
        })
      : [];

    const device = typeof body?.device === "string" ? body.device.trim().slice(0, 80) : "";
    const style = typeof body?.style === "string" ? body.style.trim().slice(0, 30) : "não informado";
    const dpi = typeof body?.dpi === "string" || typeof body?.dpi === "number" ? String(body.dpi).slice(0, 15) : "não informado";

    const system = [
      "Você é a Atlas IA, assistente de Free Fire. Responda sempre em português brasileiro, de forma amigável, direta e útil.",
      "Ajude com sensibilidade, DPI, botão de tiro, HUD, capa, mira, movimentação, treino, gráficos e desempenho.",
      "Ao sugerir sensibilidade, dê números como ponto de partida para teste; não prometa capa nem invente especificações do aparelho.",
      "Não recomende alterar DPI no iPhone. Para desempenho, indique ajustes seguros e reversíveis.",
      "Nunca recomende cheats, macros, APKs modificados, injetores ou bypass. Não diga que pode alterar o celular, jogo ou conta.",
      "Se faltar informação, faça uma pergunta objetiva. Não repita saudações.",
      "Contexto: aparelho=" + (device || "não informado") + "; estilo=" + style + "; DPI=" + dpi + ".",
    ].join("\n");

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Lovable-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [{ role: "system", content: system }, ...chat, { role: "user", content: question }],
        max_tokens: 500,
        temperature: 0.6,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!upstream.ok) {
      const details = await upstream.json().catch(() => ({}));
      console.error("atlas-chat-ai gateway error", upstream.status, details?.error?.message ?? "");
      if (upstream.status === 402) return json({ error: "Os créditos de IA do projeto acabaram. Verifique o uso de IA no Lovable." }, 402);
      if (upstream.status === 429) return json({ error: "A Atlas IA está recebendo muitas mensagens. Aguarde alguns segundos e tente novamente." }, 429);
      if (upstream.status === 401 || upstream.status === 403) return json({ error: "A conexão com o serviço de IA está inválida. Verifique a configuração do Lovable." }, 502);
      return json({ error: "O serviço de IA está indisponível no momento. Tente novamente." }, 502);
    }

    const result = await upstream.json();
    const answer = result?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      console.error("atlas-chat-ai empty gateway response");
      return json({ error: "A Atlas IA não retornou uma resposta. Tente novamente." }, 502);
    }
    return json({ answer: answer.trim().slice(0, 4000) });
  } catch (error) {
    console.error("atlas-chat-ai error", error);
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return json({ error: "A Atlas IA demorou para responder. Tente novamente." }, 504);
    }
    return json({ error: "Não foi possível responder agora. Tente novamente em instantes." }, 500);
  }
});
