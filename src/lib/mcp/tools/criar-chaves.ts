import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callRpc } from "../supabase";

export default defineTool({
  name: "criar_chaves",
  title: "Criar chaves VIP",
  description:
    "Gera novas chaves VIP do Atlas com plano, duração e nota. O prazo começa no primeiro uso. Exige a senha de administrador.",
  inputSchema: {
    password: z.string().min(1).describe("Senha de administrador do Atlas VIP."),
    quantidade: z.number().int().min(1).max(100).describe("Quantas chaves gerar (1 a 100)."),
    dias: z.number().int().min(0).max(36500).describe("Dias de validade (0 para demo sem prazo)."),
    plano: z.enum(["demo", "basic", "pro", "master"]).describe("Plano da chave."),
    nota: z.string().max(200).optional().describe("Anotação livre para identificar as chaves."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ password, quantidade, dias, plano, nota }) => {
    const data = await callRpc<unknown>("admin_create_keys", {
      _password: password,
      _count: quantidade,
      _duration_days: dias,
      _note: nota ?? null,
      _plan: plano,
    });
    const codigos = Array.isArray(data)
      ? data.map((r) => (typeof r === "string" ? r : String((r as Record<string, unknown>)?.key ?? "")))
      : [];
    return {
      content: [{ type: "text", text: `Chaves criadas: ${codigos.join(", ") || "ver dados"}` }],
      structuredContent: { chaves: codigos },
    };
  },
});
