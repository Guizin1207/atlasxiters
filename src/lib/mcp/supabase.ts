/**
 * Cliente Supabase usado pelas ferramentas MCP.
 * Sem identidade de chamador: as RPCs SECURITY DEFINER do Atlas validam a
 * senha de administrador (ou a chave VIP) por conta própria.
 * Import-safe: nada de leitura de env no topo do módulo.
 */
import { createClient } from "@supabase/supabase-js";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function configuredEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

export function supabaseProjectUrl(): string {
  const url = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new Error("SUPABASE_URL (ou VITE_SUPABASE_URL) é obrigatório");
  return url;
}

export function supabasePublishableKey(): string {
  const direct = configuredEnv(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (direct) return direct;
  const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed: unknown = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed as Record<string, unknown>;
        const key = [keys.default, ...Object.values(keys)]
          .find((v): v is string => typeof v === "string" && v.trim().startsWith("sb_publishable_"))
          ?.trim();
        if (key) return key;
      }
    } catch {
      // dicionário malformado: tenta os nomes antigos abaixo
    }
  }
  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new Error("Chave pública do backend não configurada");
}

export function supabaseAnon() {
  return createClient(supabaseProjectUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Chama uma RPC e devolve os dados, transformando o erro em ToolError-friendly. */
export async function callRpc<T = unknown>(
  name: string,
  params: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabaseAnon().rpc(name as never, params as never);
  if (error) throw new Error(traduzErro(error.message));
  return data as T;
}

export function traduzErro(message: string) {
  if (message.includes("unauthorized")) return "Senha de administrador inválida.";
  if (message.includes("invalid_key") || message.includes("invalid_access_key")) {
    return "Chave VIP inválida ou expirada.";
  }
  if (message.includes("key_already_exists")) return "Já existe uma chave com esse código.";
  if (message.includes("not_found")) return "Registro não encontrado.";
  return message;
}
