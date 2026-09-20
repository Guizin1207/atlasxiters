import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callRpc } from "../supabase";

export default defineTool({
  name: "ler_atendimento",
  title: "Ler um atendimento",
  description: "Mostra as mensagens de um atendimento do suporte. Exige a senha de administrador.",
  inputSchema: {
    password: z.string().min(1).describe("Senha de administrador do Atlas VIP."),
    thread_id: z.string().uuid().describe("Identificador do atendimento (listar_atendimentos)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ password, thread_id }) => {
    const rows = await callRpc<Record<string, unknown>[]>("admin_support_list_messages", {
      _password: password,
      _thread_id: thread_id,
    });
    const mensagens = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: String(r.id ?? ""),
      autor: String(r.sender_type ?? ""),
      texto: String(r.body ?? ""),
      criado_em: r.created_at ? String(r.created_at) : null,
      editada_em: r.edited_at ? String(r.edited_at) : null,
    }));
    return {
      content: [{ type: "text", text: `${mensagens.length} mensagem(ns) neste atendimento.` }],
      structuredContent: { mensagens },
    };
  },
});
