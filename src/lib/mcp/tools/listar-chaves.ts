import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callRpc } from "../supabase";

export default defineTool({
  name: "listar_chaves",
  title: "Listar chaves VIP",
  description:
    "Lista as chaves VIP do Atlas com plano, validade, dispositivo e situação. Exige a senha de administrador.",
  inputSchema: {
    password: z.string().min(1).describe("Senha de administrador do Atlas VIP."),
    busca: z.string().optional().describe("Filtra por código da chave, nota ou plano."),
    limite: z.number().int().min(1).max(200).optional().describe("Máximo de chaves (padrão 50)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ password, busca, limite }) => {
    const rows = await callRpc<Record<string, unknown>[]>("admin_list_keys", { _password: password });
    const termo = busca?.trim().toLowerCase();
    const lista = (Array.isArray(rows) ? rows : [])
      .filter((r) => !termo || JSON.stringify(r).toLowerCase().includes(termo))
      .slice(0, limite ?? 50)
      .map((r) => ({
        id: String(r.id ?? ""),
        chave: String(r.key ?? ""),
        plano: String(r.plan ?? ""),
        dias: Number(r.duration_days ?? 0),
        dispositivo: r.device ? String(r.device) : null,
        ativada_em: r.activated_at ? String(r.activated_at) : null,
        expira_em: r.expires_at ? String(r.expires_at) : null,
        revogada: r.revoked === true,
        mestra: r.is_master === true,
        nota: r.note ? String(r.note) : null,
      }));

    return {
      content: [{ type: "text", text: `${lista.length} chave(s) encontrada(s).` }],
      structuredContent: { chaves: lista },
    };
  },
});
