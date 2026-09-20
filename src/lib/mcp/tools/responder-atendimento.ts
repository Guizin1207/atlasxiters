import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callRpc } from "../supabase";

export default defineTool({
  name: "responder_atendimento",
  title: "Responder no suporte",
  description: "Envia uma resposta do administrador em um atendimento do suporte. Exige a senha de administrador.",
  inputSchema: {
    password: z.string().min(1).describe("Senha de administrador do Atlas VIP."),
    thread_id: z.string().uuid().describe("Identificador do atendimento."),
    texto: z.string().trim().min(1).max(1000).describe("Mensagem a enviar (até 1000 caracteres)."),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async ({ password, thread_id, texto }) => {
    await callRpc("admin_support_send_message", { _password: password, _thread_id: thread_id, _body: texto });
    return { content: [{ type: "text", text: "Resposta enviada no atendimento." }] };
  },
});
