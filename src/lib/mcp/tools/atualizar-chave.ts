import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callRpc } from "../supabase";

export default defineTool({
  name: "atualizar_chave",
  title: "Editar chave VIP",
  description:
    "Altera plano, duração e o código de uma chave VIP existente. Atenção: plano master torna a chave mestra. Exige a senha de administrador.",
  inputSchema: {
    password: z.string().min(1).describe("Senha de administrador do Atlas VIP."),
    id: z.string().uuid().describe("Identificador da chave (campo id em listar_chaves)."),
    plano: z.enum(["demo", "basic", "pro", "master"]).describe("Novo plano da chave."),
    dias: z.number().int().min(0).max(36500).describe("Nova duração em dias (ignorada em master e demo)."),
    chave: z.string().min(4).max(40).describe("Código da chave (será gravado em maiúsculas)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ password, id, plano, dias, chave }) => {
    const row = await callRpc<Record<string, unknown>>("admin_update_key_access", {
      _password: password,
      _id: id,
      _plan: plano,
      _duration_days: dias,
      _key: chave,
    });
    return {
      content: [{ type: "text", text: `Chave ${String(row?.key ?? chave)} atualizada para o plano ${plano}.` }],
      structuredContent: {
        chave: {
          id: String(row?.id ?? id),
          codigo: String(row?.key ?? chave),
          plano: String(row?.plan ?? plano),
          expira_em: row?.expires_at ? String(row.expires_at) : null,
          mestra: row?.is_master === true,
        },
      },
    };
  },
});
