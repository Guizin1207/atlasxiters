import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText } from "npm:ai";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
} from "../_shared/ai-gateway.ts";

type SensiStyle = "precisao" | "equilibrado" | "agressivo";

const clamp = (value: unknown, min = 20, max = 200) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
};

const cleanResult = (raw: Record<string, unknown>, isIOS = false) => ({
  geral: clamp(raw.geral),
  pontoVermelho: clamp(raw.pontoVermelho),
  mira2x: clamp(raw.mira2x),
  mira4x: clamp(raw.mira4x),
  miraAwm: clamp(raw.miraAwm),
  olharLivre: clamp(raw.olharLivre),
  dpiRecomendado: isIOS ? 0 : Math.max(320, Math.min(720, Math.round(Number(raw.dpiRecomendado) || 480))),
  precisaoEstimada: Math.max(1, Math.min(99, Math.round(Number(raw.precisaoEstimada) || 85))),
  notas: Array.isArray(raw.notas)
    ? raw.notas.filter((item): item is string => typeof item === "string").slice(0, 5)
    : [],
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "A IA não está configurada neste projeto." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim().slice(0, 500) : "";
    const chat = Array.isArray(body?.chat) ? body.chat.slice(-8).filter((m: unknown) => m && typeof m === "object") : [];
    const device = typeof body?.device === "string" ? body.device.trim().slice(0, 100) : "";
    const dpi = Number(body?.dpi);
    const fingers = Number(body?.fingers);
    const isIOS = /iphone|ipad|ipod/i.test(device);
    const style = body?.style as SensiStyle;
    const refreshRate = Number(body?.refreshRate);
    const ram = typeof body?.ram === "string" ? body.ram : "6-8";
    const deviceAge = Number(body?.deviceAge);
    const screen = body?.screen && typeof body.screen === "object" ? body.screen as Record<string, unknown> : {};
    const screenWidth = Number(screen.width);
    const screenHeight = Number(screen.height);
    const screenRatio = typeof screen.ratio === "string" ? screen.ratio.slice(0, 8) : "não informada";
    const pixelRatio = Number(screen.pixelRatio);

    if (!device || ![2, 3, 4].includes(fingers) || !["precisao", "equilibrado", "agressivo"].includes(style) || ![60, 90, 120].includes(refreshRate) || !["3-4", "6-8", "12+"].includes(ram) || ![0, 1, 2, 3].includes(deviceAge)) {
      return new Response(JSON.stringify({ error: "Dados de sensibilidade inválidos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const initialRunId = getLovableAiGatewayRunId(req);
    const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: {
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      fetch: runIdFetch.fetch,
    });

    const prompt = `Você é o motor especialista de sensibilidade do Atlas VIP para Free Fire 2026.
Sua tarefa é analisar o MODELO DO APARELHO e criar uma configuração personalizada, e não apenas devolver uma sensibilidade genérica.

Dados do jogador:
- aparelho: ${device}
- plataforma: ${isIOS ? "iOS/iPhone/iPad" : "Android ou não identificado"}
- DPI informado: ${Number.isFinite(dpi) ? Math.max(180, Math.min(900, dpi)) : "não informado"}
- dedos: ${fingers}
- estilo: ${style}
- taxa de atualização: ${refreshRate} Hz
- RAM: ${ram} GB
- idade aproximada: ${deviceAge === 0 ? "novo" : `${deviceAge} ano(s)`}
- tela CSS detectada: ${Number.isFinite(screenWidth) && Number.isFinite(screenHeight) ? `${screenWidth}x${screenHeight}` : "não informada"}
- proporção detectada: ${screenRatio}:1
- densidade lógica detectada: ${Number.isFinite(pixelRatio) ? pixelRatio : "não informada"}

REGRAS IMPORTANTES:
1. Use o nome/modelo do aparelho como fator principal. Se o modelo for conhecido, adapte a configuração à sua tela, proporção, resposta de toque, desempenho e taxa de atualização; não use uma tabela fixa universal. Use a proporção detectada apenas como pista complementar, pois ela pode refletir a janela do navegador.
1.2. Se o usuário pedir ajuste em uma sensibilidade anterior, trate os valores atuais e a mensagem como contexto e altere somente o necessário.
1.1. Use RAM, taxa de atualização e idade como fatores de estabilidade/performance; não trate RAM isoladamente como potência real do aparelho. Considere de forma aproximada tela, proporção, fluidez, resposta de toque e capacidade do aparelho quando essas características forem conhecidas. Não invente especificações.
2. A configuração deve ser específica para Free Fire 2026 e coerente entre Geral, Ponto Vermelho, 2x, 4x, AWM e Olhar livre.
3. Evite entregar os mesmos números para aparelhos diferentes. Faça ajustes reais conforme o modelo, sem aleatoriedade inútil.
4. Para iOS, NÃO use DPI como fator de ajuste. iPhone/iPad não deve receber recomendação de DPI. Concentre a calibração na sensibilidade do jogo, modelo/tamanho da tela, fluidez e estilo. Nesse caso, dpiRecomendado deve ser 0.
5. Para Android, use DPI apenas como fator secundário e respeite o DPI informado. Não trate DPI como garantia de capa.
6. Priorize controle de arrasto, estabilidade da mira e resposta em curta/média distância. Não prometa porcentagem real de headshot.
7. Gere uma configuração de nível PRO, mas realista: evite números redondos demais e ajuste cada mira de forma independente. Pense em controle de arrasto, microajuste, estabilidade no spray, velocidade de troca de alvo, combate curto e médio e precisão com AWM.
8. Além dos valores, as notas devem explicar de forma específica o perfil criado para este aparelho, citar como a tela/proporção influenciou quando isso for confiável e dar 2 a 3 instruções práticas de uso. Não diga apenas "teste no treinamento".
9. A configuração deve parecer feita sob medida para o modelo informado, sem prometer que ela garante capa ou vitória.
10. Responda ao pedido atual da conversa, podendo explicar o ajuste nas notas. Não ignore a pergunta do usuário.

Mensagem atual do jogador:
${question || "Gerar uma configuração inicial personalizada"}
Histórico recente da conversa:
${JSON.stringify(chat)}

Responda SOMENTE com JSON válido, sem markdown, neste formato:
{
  "geral": number,
  "pontoVermelho": number,
  "mira2x": number,
  "mira4x": number,
  "miraAwm": number,
  "olharLivre": number,
  "dpiRecomendado": number,
  "precisaoEstimada": number,
  "notas": ["perfil específico do aparelho em uma frase", "ajuste prático 1", "ajuste prático 2", "ajuste prático 3"]
}

Use valores inteiros de 20 a 200 para as sensibilidades, DPI recomendado de 320 a 720 e precisão estimada de 1 a 99. Mantenha a diferença entre miras coerente com o aparelho e o estilo. A precisão estimada é apenas um índice heurístico de adequação, nunca uma promessa de desempenho.`;

    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      prompt,
      abortSignal: req.signal,
      providerOptions: {
        openai: {
          forceReasoning: true,
          store: false,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    const text = (await result.text).trim().replace(/^\`\`\`json\s*/i, "").replace(/\s*\`\`\`$/i, "");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const sensi = cleanResult(parsed, isIOS);

    return new Response(JSON.stringify(sensi), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      return new Response(null, { status: 499, headers: corsHeaders });
    }
    console.error("sensi-ai error", error);
    return new Response(JSON.stringify({ error: (error as Error)?.message ?? "Não foi possível gerar a sensibilidade com IA agora." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
