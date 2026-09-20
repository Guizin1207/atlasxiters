import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callRpc } from "../supabase";

export default defineTool({
  name: "estatisticas_dispositivos",
  title: "Estatísticas por dispositivo",
  description: "Mostra quantas chaves estão em uso por sistema (Android, iOS, PC). Exige a senha de administrador.",
  inputSchema: { password: z.string().min(1).describe("Senha de administrador do Atlas VIP.") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ password }) => {
    const rows = await callRpc<Record<string, unknown>[]>("admin_device_stats", { _password: password });
    const stats = (Array.isArray(rows) ? rows : []).map((r) => ({
      dispositivo: String(r.device ?? "Não informado"),
      total: Number(r.total ?? 0),
    }));
    return {
      content: [
        {
          type: "text",
          text: stats.map((s) => `${s.dispositivo}: ${s.total}`).join(" | ") || "Sem dados.",
        },
      ],
      structuredContent: { estatisticas: stats },
    };
  },
});
