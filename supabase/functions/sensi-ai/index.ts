import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createOpenAI } from "npm:@ai-sdk/openai@4.0.71";
import { generateText } from "npm:ai@7.0.107";

type SensiStyle = "precisao" | "equilibrado" | "agressivo";

const clamp = (value: unknown, min = 20, max = 200) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
};

const cleanResult = (raw: Record<string, unknown>) => ({
  geral: clamp(raw.geral),
  pontoVermelho: clamp(raw.pontoVermelho),
  mira2x: clamp(raw.mira2x),
  mira4x: clamp(raw.mira4x),
  miraAwm: clamp(raw.miraAwm),
  olharLivre: clamp(raw.olharLivre),
  dpiRecomendado: Math.max(320, Math.min(720, Math.round(Number(raw.dpiRecomendado) || 480))),
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
    const device = typeof body?.device === "string" ? body.device.trim().slice(0, 100) : "";
    const dpi = Number(body?.dpi);
    const fingers = Number(body?.fingers);
    const style = body?.style as SensiStyle;

    if (!device || ![2, 3, 4].includes(fingers) || !["precisao", "equilibrado", "agressivo"].includes(style)) {
      return new Response(JSON.stringify({ error: "Dados de sensibilidade inválidos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: {
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });

    const prompt = `Gere uma configuração de sensibilidade para Free Fire em 2026.
Use os dados do jogador:
- aparelho: ${device}
- DPI atual: ${Number.isFinite(dpi) ? Math.max(180, Math.min(900, dpi)) : 480}
- dedos: ${fingers}
- estilo: ${style}

Considere estabilidade de toque, tamanho/taxa de resposta da tela de forma aproximada, DPI, quantidade de dedos e o estilo informado. Não invente especificações exatas do aparelho que não foram fornecidas. A configuração deve ser prática para testar no jogo.

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
  "notas": ["string", "string", "string"]
}

Use valores inteiros de 20 a 200 para as sensibilidades, DPI recomendado de 320 a 720 e precisão estimada de 1 a 99. A precisão estimada é apenas uma estimativa de ajuste, não uma garantia de desempenho.`;

    const result = await generateText({
      model: lovable.responses("openai/gpt-6-astra"),
      prompt,
      abortSignal: req.signal,
      providerOptions: {
        openai: {
          store: false,
          reasoningEffort: "low",
        },
      },
    });

    const text = result.text.trim().replace(/^\`\`\`json\s*/i, "").replace(/\s*\`\`\`$/i, "");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const sensi = cleanResult(parsed);

    return new Response(JSON.stringify(sensi), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      return new Response(null, { status: 499, headers: corsHeaders });
    }
    console.error("sensi-ai error", error);
    return new Response(JSON.stringify({ error: "Não foi possível gerar a sensibilidade com IA agora." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
