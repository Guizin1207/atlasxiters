import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callRpc } from "../supabase";

export default defineTool({
  name: "revogar_chave",
  title: "Revogar ou liberar chave",
  description:
    "Bloqueia (revoga) ou libera novamente uma chave VIP. Chaves mestras não podem ser revogadas. Exige a senha de administrador.",
  inputSchema: {
    password: z.string().min(1).describe("Senha de administrador do Atlas VIP."),
    id: z.string().uuid().describe("Identificador da chave."),
    revogar: z.boolean().describe("true para bloquear a chave, false para liberar de novo."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ password, id, revogar }) => {
    await callRpc(revogar ? "admin_revoke_key" : "admin_unrevoke_key", { _password: password, _id: id });
    return {
      content: [{ type: "text", text: revogar ? "Chave revogada." : "Chave liberada novamente." }],
      structuredContent: { id, revogada: revogar },
    };
  },
});
