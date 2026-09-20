import { withTimeout } from "./request-timeout";

export type PushDelivery = {
  ok: boolean;
  sent: number;
  message: string;
  code?: string;
  httpStatus?: number;
};

const MESSAGES: Record<string, string> = {
  FUNCTION_OUTDATED: "O servidor ainda usa uma versão antiga das notificações. Publique a função notify-admin atualizada no Lovable Cloud.",
  FUNCTION_NOT_FOUND: "A função de notificações não está publicada no servidor.",
  PUSH_NOT_CONFIGURED: "Falta configurar o envio de notificações (VAPID) no servidor.",
  PUSH_CONFIG_INVALID: "A configuração VAPID do servidor é inválida. Ela precisa ser corrigida no Lovable Cloud.",
  PUSH_CREDENTIALS_REJECTED: "O serviço de push recusou as credenciais VAPID. Confira o par de chaves do servidor e reative este aparelho se ele foi trocado.",
  PUSH_SUBSCRIPTION_EXPIRED: "O cadastro de notificações deste aparelho expirou. Ative novamente.",
  NO_RECIPIENTS: "Não há aparelho cadastrado para este destinatário. Ative os avisos no aparelho que deve receber.",
  GATEWAY_AUTH_FAILED: "O servidor recusou a autenticação da função (401). Confira a configuração de publicação de notify-admin.",
  ADMIN_AUTH_FAILED: "O login de ADM não foi validado. Entre novamente pelo Acesso ADM.",
  REQUEST_FORBIDDEN: "O servidor não autorizou este envio. Confira o login e o destinatário.",
  FUNCTION_BOOT_ERROR: "A função de notificações não conseguiu iniciar. Confira sua publicação no Lovable Cloud.",
  DATABASE_ERROR: "O servidor não conseguiu consultar o cadastro de notificações.",
  NETWORK_ERROR: "Não foi possível contatar o serviço de notificações. Tente novamente com conexão.",
  PUSH_SEND_FAILED: "O serviço de push não aceitou o envio. Confira o resultado do teste no painel do ADM.",
};

/** Usa somente códigos conhecidos; nunca mostra corpos arbitrários com possíveis segredos. */
export async function pushFailure(error: unknown, payload?: unknown): Promise<PushDelivery> {
  const context = (error as { context?: Response } | null)?.context;
  const httpStatus = typeof context?.status === "number" ? context.status : undefined;
  let data = payload as { code?: string; error?: string } | undefined;
  if (context && typeof context.clone === "function") {
    try { data = await withTimeout(context.clone().json(), 2_000); } catch { /* corpo não JSON */ }
  }
  let code = data?.code;
  if (!code || !Object.prototype.hasOwnProperty.call(MESSAGES, code)) {
    if (data?.error === "Tipo de notificação inválido.") code = "FUNCTION_OUTDATED";
    else if (data?.error === "Notificações não configuradas.") code = "PUSH_NOT_CONFIGURED";
    else if (data?.code === "BOOT_ERROR" || data?.code === "WORKER_ERROR") code = "FUNCTION_BOOT_ERROR";
    else if (httpStatus === 404) code = "FUNCTION_NOT_FOUND";
    else if (httpStatus === 401) code = "GATEWAY_AUTH_FAILED";
    else if (httpStatus === 403) code = "REQUEST_FORBIDDEN";
    else code = "PUSH_SEND_FAILED";
  }
  return { ok: false, sent: 0, code, httpStatus, message: MESSAGES[code] };
}
