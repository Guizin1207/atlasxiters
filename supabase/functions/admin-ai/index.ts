/**
 * IA administrativa do Atlas VIP.
 * Recebe a senha mestra, valida no banco e conversa com o modelo.
 * A IA apenas PROPÕE mudanças no painel — nada é aplicado aqui.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { convertToModelMessages, streamText, tool, stepCountIs, jsonSchema, type UIMessage } from "npm:ai";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  getLovableAiGatewayResponseHeaders,
  withLovableAiGatewayRunIdHeader,
} from "../_shared/ai-gateway.ts";

const ICONS = [
  "crosshair",
  "eye",
  "zap",
  "shield",
  "radar",
  "gauge",
  "wand-2",
  "box",
  "target",
  "cpu",
  "gamepad-2",
];

const proposalSchema = jsonSchema<{
  operation: string;
  id: string;
  name: string | null;
  tag: string | null;
  minPlan: string;
  icon: string;
  position: number;
  reason: string;
}>({
  type: "object",
  additionalProperties: false,
  required: ["operation", "id", "name", "tag", "minPlan", "icon", "position", "reason"],
  properties: {
    operation: { type: "string", enum: ["create", "update", "delete", "reorder"] },
    id: { type: "string", description: "Identificador curto da função, ex: aim, radar, turbo" },
    name: { type: ["string", "null"], description: "Nome exibido no painel" },
    tag: { type: ["string", "null"], description: "Categoria curta, ex: Combate, Visão" },
    minPlan: { type: "string", enum: ["basic", "pro", "master"] },
    icon: { type: "string", enum: ICONS },
    position: { type: "number", description: "Ordem no painel (menor aparece primeiro)" },
    reason: { type: "string", description: "Explicação curta em português da mudança" },
  },
});

const SYSTEM_PROMPT = `Você é a IA administrativa do Atlas VIP, um painel VIP para Free Fire.
Fale sempre em português do Brasil, de forma curta e direta.

Você ajuda o administrador a criar, editar, remover e reorganizar as funções do painel do usuário.
Para qualquer mudança, chame a ferramenta propor_mudanca_painel com UMA proposta por chamada.
A proposta NÃO é aplicada automaticamente: o administrador precisa confirmar na tela.
Depois de propor, diga em uma frase o que a proposta faz e peça a confirmação.

Regras:
- Planos válidos: basic, pro, master.
- Ícones válidos: ${ICONS.join(", ")}.
- Use identificadores curtos, minúsculos, sem espaços nem acentos.
- Em "delete" e "reorder", preencha id e position; nome e categoria podem ser nulos.
- Nunca invente que a mudança já foi aplicada.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: "A IA não está configurada neste projeto." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => null);
    const password = typeof body?.password === "string" ? body.password : "";
    const messages = Array.isArray(body?.messages) ? (body.messages as UIMessage[]) : null;
    const functionsSnapshot = typeof body?.functions === "string" ? body.functions : "";

    if (!password || !messages) {
      return new Response(JSON.stringify({ error: "Requisição inválida." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: isAdmin, error: adminError } = await supabase.rpc("_check_admin", {
      _password: password,
    });
    if (adminError || isAdmin !== true) {
      return new Response(JSON.stringify({ error: "Senha mestra inválida." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const initialRunId = getLovableAiGatewayRunId(req);
    const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: lovableApiKey,
      headers: {
        "Lovable-API-Key": lovableApiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      fetch: runIdFetch.fetch,
    });

    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      system: `${SYSTEM_PROMPT}\n\nFunções atuais do painel:\n${functionsSnapshot || "(nenhuma)"}`,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(20),
      abortSignal: req.signal,
      tools: {
        propor_mudanca_painel: tool({
          description:
            "Propõe uma mudança no catálogo de funções do painel. Não aplica nada; aguarda a confirmação do administrador.",
          inputSchema: proposalSchema,
          execute: async (input) => ({
            status: "aguardando_confirmacao",
            proposta: input,
          }),
        }),
      },
      providerOptions: {
        openai: {
          store: false,
          include: ["reasoning.encrypted_content"],
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
        },
      },
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: true,
      headers: getLovableAiGatewayResponseHeaders(undefined, {
        ...corsHeaders,
        ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
      }),
    });

    return await withLovableAiGatewayRunIdHeader(response, runIdFetch, corsHeaders);
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      return new Response(null, { status: 499, headers: corsHeaders });
    }
    console.error("admin-ai error", error);
    return new Response(
      JSON.stringify({ error: (error as Error)?.message ?? "Erro inesperado na IA." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
