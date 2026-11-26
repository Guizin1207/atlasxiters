import { supabase } from "@/integrations/supabase/client";

export const DOWNLOAD_FILE_BUCKET = "app-downloads";
export const DOWNLOAD_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_DOWNLOAD_FILE_URL = "/atlas-test-files/atlas-config-test.txt";
export const DEFAULT_DOWNLOAD_FILE_NAME = "atlas-config-test.txt";

export type DownloadFileConfig = {
  path: string;
  file_name: string;
  file_size: number;
  content_type: string;
  updated_at?: string | null;
};

export type PreparedDownload = {
  blob: Blob;
  fileName: string;
  version: string;
};

export function isValidDownloadTextFile(file: Pick<File, "name" | "size">): boolean {
  return file.name.toLowerCase().endsWith(".txt") && file.size > 0 && file.size <= DOWNLOAD_FILE_MAX_BYTES;
}

export function isCurrentDownloadReady(storedVersion: string | null, currentVersion: string): boolean {
  return Boolean(currentVersion && storedVersion === currentVersion);
}

export async function uploadManagedDownload(password: string, file: File): Promise<DownloadFileConfig> {
  const { data, error } = await supabase.functions.invoke("app-download", {
    body: { action: "upload-url", password },
  });
  if (error) throw new Error(error.message || "Não foi possível preparar o envio.");
  const signed = data as { path?: string; token?: string };
  if (!signed?.path || !signed?.token) throw new Error("O servidor não liberou o envio do arquivo.");

  const { error: uploadError } = await supabase.storage
    .from(DOWNLOAD_FILE_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, file, { contentType: "text/plain" });
  if (uploadError) throw new Error(uploadError.message || "Não foi possível enviar o arquivo.");

  const { data: saved, error: saveError } = await supabase.rpc("admin_save_download_file", {
    _password: password,
    _path: signed.path,
    _file_name: file.name,
    _file_size: file.size,
    _content_type: "text/plain",
  });
  if (saveError) {
    await supabase.functions.invoke("app-download", {
      body: { action: "delete", password, path: signed.path },
    });
    throw new Error(saveError.message || "O envio foi feito, mas não foi possível ativar o arquivo.");
  }
  return saved as DownloadFileConfig;
}

export async function deleteManagedDownload(password: string, path: string): Promise<boolean> {
  if (!path) return true;
  const { error } = await supabase.functions.invoke("app-download", {
    body: { action: "delete", password, path },
  });
  return !error;
}

/** Busca o conteúdo antes do toque para não perder a ativação do usuário no iOS. */
export async function prepareManagedDownload(auth: { key?: string | null; password?: string | null }): Promise<PreparedDownload> {
  const { data, error } = await supabase.rpc("get_download_file");
  if (error) throw new Error(error.message || "Não foi possível localizar o arquivo atual.");
  const config = data as DownloadFileConfig;

  if (!config.path) {
    const response = await fetch(DEFAULT_DOWNLOAD_FILE_URL);
    if (!response.ok) throw new Error("Não foi possível carregar o arquivo padrão.");
    return {
      blob: await response.blob(),
      fileName: config.file_name || DEFAULT_DOWNLOAD_FILE_NAME,
      version: "default",
    };
  }

  const { data: signed, error: signedError } = await supabase.functions.invoke("app-download", {
    body: {
      action: "download-url",
      key: auth.key ?? undefined,
      password: auth.password ?? undefined,
    },
  });
  if (signedError) throw new Error(signedError.message || "Não foi possível liberar o download.");
  const result = signed as { url?: string; fileName?: string; path?: string };
  if (!result?.url) throw new Error("O servidor não retornou o arquivo atual.");

  const response = await fetch(result.url);
  if (!response.ok) throw new Error("Não foi possível carregar o arquivo atual.");
  return {
    blob: await response.blob(),
    fileName: result.fileName || config.file_name || DEFAULT_DOWNLOAD_FILE_NAME,
    version: result.path || config.path,
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * No iPhone, a folha de compartilhamento oferece "Salvar em Arquivos" e fecha
 * sem trocar a página do Atlas. Nos demais casos, um Blob evita a visualização
 * de texto em uma nova tela e mantém o usuário no sistema.
 */
export async function deliverManagedDownload(blob: Blob, fileName: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], fileName, { type: "text/plain;charset=utf-8" });
  const touch = window.matchMedia("(pointer: coarse)").matches;
  if (touch && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return "shared";
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return "cancelled";
      // Se a folha de compartilhamento falhar, tenta o download comum sem sair do app.
    }
  }
  downloadBlob(blob, fileName);
  return "downloaded";
}
