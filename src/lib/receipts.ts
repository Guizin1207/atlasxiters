import { supabase } from "@/integrations/supabase/client";

export const RECEIPT_PREFIX = "[[receipt]]";
export const RECEIPT_BUCKET = "support-receipts";
export const RECEIPT_MAX_BYTES = 8 * 1024 * 1024;
export const RECEIPT_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif"] as const;

export function isReceiptBody(body: string) {
  return body.startsWith(RECEIPT_PREFIX);
}

export function receiptRef(body: string) {
  return body.slice(RECEIPT_PREFIX.length);
}

/** Aceita URL antiga (pública) ou caminho novo dentro do bucket privado. */
export async function resolveReceiptUrl(ref: string): Promise<string | null> {
  if (/^https?:\/\//i.test(ref)) return ref;
  const { data } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(ref, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}
