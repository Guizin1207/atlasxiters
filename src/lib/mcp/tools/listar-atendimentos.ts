import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callRpc } from "../supabase";

export default defineTool({
  name: "listar_atendimentos",
  title: "Listar atendimentos do suporte",
  description: "Lista as conversas abertas no chat de suporte do Atlas. Exige a senha de administrador.",
  inputSchema: { password: z.string().min(1).describe("Senha de administrador do Atlas VIP.") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ password }) => {
    const rows = await callRpc<Record<string, unknown>[]>("admin_support_list_threads", { _password: password });
    const conversas = (Array.isArray(rows) ? rows : []).map((r) => ({
      thread_id: String(r.thread_id ?? r.id ?? ""),
      chave: r.key ? String(r.key) : null,
      ultima_mensagem: r.last_body ? String(r.last_body) : null,
      atualizado_em: r.updated_at ? String(r.updated_at) : null,
      nao_lidas: Number(r.unread ?? 0),
    }));
    return {
      content: [{ type: "text", text: `${conversas.length} atendimento(s).` }],
      structuredContent: { atendimentos: conversas },
    };
  },
});
