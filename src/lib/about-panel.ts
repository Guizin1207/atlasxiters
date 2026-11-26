import { supabase } from "@/integrations/supabase/client";

export type AboutVideoType = "none" | "youtube" | "gallery";

export type AboutPanelConfig = {
  bio: string;
  description: string;
  video_type: AboutVideoType;
  youtube_url: string;
  gallery_video_path: string;
  gallery_video_name: string;
  updated_at?: string | null;
};

export type PanelFeedback = {
  id: string;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
  key?: string | null;
};

export type PanelFeedbackList = {
  items: PanelFeedback[];
  total: number;
  average: number;
};

export const PANEL_MEDIA_BUCKET = "panel-media";
export const PANEL_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const PANEL_VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "ogg"] as const;

export const DEFAULT_ABOUT_PANEL: AboutPanelConfig = {
  bio: "Atlas VIP — Painel de desempenho e configuração para Free Fire.",
  description: "",
  video_type: "none",
  youtube_url: "",
  gallery_video_path: "",
  gallery_video_name: "",
};

/** Extrai URL de embed segura a partir de links do YouTube (watch, youtu.be, shorts, embed). */
export function extractYouTubeEmbedUrl(rawUrl: string): string | null {
  const input = rawUrl.trim();
  if (!input) return null;
  try {
    const parsed = new URL(input.startsWith("http") ? input : `https://${input}`);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    let videoId = "";
    if (host === "youtu.be") {
      videoId = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v") ?? "";
      } else {
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") {
          videoId = parts[1] ?? "";
        }
      }
    }
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

export async function uploadPanelVideo(
  password: string,
  file: File
): Promise<{ path: string; name: string } | null> {
  let ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!(PANEL_VIDEO_EXTENSIONS as readonly string[]).includes(ext)) {
    ext = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
  }
  const { data, error } = await supabase.functions.invoke("panel-media", {
    body: { action: "upload-url", password, ext },
  });
  if (error) return null;
  const signed = data as { path?: string; token?: string };
  if (!signed?.path || !signed?.token) return null;

  const { error: uploadError } = await supabase.storage
    .from(PANEL_MEDIA_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type || "video/mp4",
    });
  if (uploadError) return null;
  return { path: signed.path, name: file.name };
}

export async function resolvePanelVideoUrl(
  path: string,
  auth: { key?: string | null; password?: string | null }
): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!auth.key && !auth.password) return null;
  const { data, error } = await supabase.functions.invoke("panel-media", {
    body: {
      action: "view-url",
      path,
      key: auth.key ?? undefined,
      password: auth.password ?? undefined,
    },
  });
  if (error) return null;
  return (data as { url?: string })?.url ?? null;
}

export async function deletePanelVideo(password: string, path: string): Promise<boolean> {
  if (!path) return true;
  const { error } = await supabase.functions.invoke("panel-media", {
    body: { action: "delete", password, path },
  });
  return !error;
}