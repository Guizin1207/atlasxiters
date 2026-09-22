import { supabase } from "@/integrations/supabase/client";

export const RECEIPT_PREFIX = "[[receipt]]";
export const RECEIPT_BUCKET = "support-receipts";
export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;
export const RECEIPT_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif"] as const;

/** Credenciais usadas para autorizar o acesso ao comprovante no servidor. */
export type ReceiptAuth = { key?: string | null; password?: string | null };

export function isReceiptBody(body: string) {
  return body.startsWith(RECEIPT_PREFIX);
}

export function receiptRef(body: string) {
  return body.slice(RECEIPT_PREFIX.length);
}

/**
 * Aceita URL antiga (pública) ou caminho novo dentro do bucket privado.
 * O link temporário é criado no servidor, que valida a chave do usuário
 * (só abre comprovantes da própria chave) ou a senha do ADM.
 */
export async function resolveReceiptUrl(ref: string, auth: ReceiptAuth): Promise<string | null> {
  if (/^https?:\/\//i.test(ref)) return ref;
  if (!auth.key && !auth.password) return null;
  const { data, error } = await supabase.functions.invoke("support-receipt", {
    body: { action: "view-url", path: ref, key: auth.key ?? undefined, password: auth.password ?? undefined },
  });
  if (error) return null;
  return (data as { url?: string })?.url ?? null;
}

/** Sobe o comprovante por URL assinada; o bucket não aceita envio anônimo direto. */
export async function uploadReceipt(key: string, file: File, ext: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("support-receipt", {
    body: { action: "upload-url", key, ext },
  });
  if (error) return null;
  const signed = data as { path?: string; token?: string };
  if (!signed?.path || !signed?.token) return null;
  const { error: uploadError } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || undefined });
  if (uploadError) return null;
  return signed.path;
}
