import { useCallback, useEffect, useRef, useState } from "react";
import { Coins, Loader2, Save, Video, Youtube, Upload, Trash2, Star, Info, MessageSquareReply, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import {
  DEFAULT_ABOUT_PANEL,
  PANEL_VIDEO_MAX_BYTES,
  deletePanelVideo,
  extractYouTubeEmbedUrl,
  resolvePanelVideoUrl,
  uploadPanelVideo,
  isValidAdminFeedbackReply,
  type AboutPanelConfig,
  type AboutVideoType,
  type PanelFeedback,
} from "@/lib/about-panel";

export function AboutPanelAdminCard() {
  const { password } = useAdmin();
  const [config, setConfig] = useState<AboutPanelConfig>(DEFAULT_ABOUT_PANEL);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<PanelFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!password) return;
    const [aboutRes, fbRes] = await Promise.all([
      supabase.rpc("get_about_panel"),
      supabase.rpc("admin_list_panel_feedbacks", { _password: password }),
    ]);
    if (!aboutRes.error && aboutRes.data) {
      const next = { ...DEFAULT_ABOUT_PANEL, ...(aboutRes.data as Partial<AboutPanelConfig>) };
      setConfig(next);
      if (next.gallery_video_path) {
        const url = await resolvePanelVideoUrl(next.gallery_video_path, { password });
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
    if (!fbRes.error && Array.isArray(fbRes.data)) {
      setFeedbacks(fbRes.data as unknown as PanelFeedback[]);
    }
    setLoading(false);
  }, [password]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveConfig = async (next: AboutPanelConfig = config) => {
    if (!password || saving) return;
    if (next.video_type === "youtube" && !extractYouTubeEmbedUrl(next.youtube_url)) {
      toast.error("Informe um link válido do YouTube.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("admin_save_about_panel", {
      _password: password,
      _bio: next.bio,
      _description: next.description,
      _video_type: next.video_type,
      _youtube_url: next.youtube_url,
      _gallery_video_path: next.gallery_video_path,
      _gallery_video_name: next.gallery_video_name,
    });
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar as alterações.");
      return;
    }
    if (data) setConfig({ ...DEFAULT_ABOUT_PANEL, ...(data as Partial<AboutPanelConfig>) });
    toast.success("Sobre o painel atualizado e sincronizado com o perfil.");
  };

  const handleVideoUpload = async (file: File) => {
    if (!password || uploading) return;
    if (!file.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo (MP4, WebM, MOV ou OGG).");
      return;
    }
    if (file.size > PANEL_VIDEO_MAX_BYTES) {
      toast.error("O vídeo deve ter no máximo 50 MB.");
      return;
    }
    setUploading(true);
    const previousPath = config.gallery_video_path;
    const uploaded = await uploadPanelVideo(password, file);
    if (!uploaded) {
      setUploading(false);
      toast.error("Não foi possível enviar o vídeo.");
      return;
    }
    const next: AboutPanelConfig = {
      ...config,
      video_type: "gallery",
      gallery_video_path: uploaded.path,
      gallery_video_name: uploaded.name,
    };
    setConfig(next);
    const url = await resolvePanelVideoUrl(uploaded.path, { password });
    setPreviewUrl(url);
    setUploading(false);
    if (previousPath && previousPath !== uploaded.path) {
      void deletePanelVideo(password, previousPath);
    }
    await saveConfig(next);
  };

  const removeGalleryVideo = async () => {
    if (!password || !config.gallery_video_path) return;
    const oldPath = config.gallery_video_path;
    const next: AboutPanelConfig = {
      ...config,
      video_type: config.youtube_url ? "youtube" : "none",
      gallery_video_path: "",
      gallery_video_name: "",
    };
    setConfig(next);
    setPreviewUrl(null);
    void deletePanelVideo(password, oldPath);
    await saveConfig(next);
  };

  const removeFeedback = async (id: string) => {
    if (!password) return;
    const { error } = await supabase.rpc("admin_delete_panel_feedback", { _password: password, _id: id });
    if (error) {
      toast.error("Não foi possível excluir o feedback.");
      return;
    }
    setFeedbacks((prev) => prev.filter((item) => item.id !== id));
    toast.success("Feedback excluído.");
  };

  const replyToFeedback = async (id: string) => {
    const reply = (replies[id] ?? "").trim();
    if (!password || replyingId) return;
    if (!isValidAdminFeedbackReply(reply)) {
      toast.error("A resposta deve ter entre 2 e 1000 caracteres.");
      return;
    }
    setReplyingId(id);
    const { data, error } = await supabase.rpc("admin_reply_panel_feedback", {
      _password: password,
      _id: id,
      _reply: reply,
    });
    setReplyingId(null);
    if (error) {
      toast.error(error.message || "Não foi possível responder ao feedback.");
      return;
    }
    const result = data as { admin_reply?: string; admin_reply_at?: string } | null;
    setFeedbacks((prev) => prev.map((item) => item.id === id ? {
      ...item,
      admin_reply: result?.admin_reply ?? reply,
      admin_reply_at: result?.admin_reply_at ?? new Date().toISOString(),
    } : item));
    setReplyOpenId(null);
    toast.success("Resposta publicada no feedback do usuário.");
  };

  const youtubeEmbed = extractYouTubeEmbedUrl(config.youtube_url);

  if (loading) {
    return (
      <section className="glass-strong rounded-3xl p-6 flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="glass-strong rounded-3xl p-6 space-y-5">
        <header className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl glass flex items-center justify-center">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <p className="vip-eyebrow">Sincronizado com Perfil</p>
            <h2 className="vip-title text-base leading-none">Sobre o painel</h2>
          </div>
        </header>

        <div className="space-y-4">
          <div>
            <label className="vip-eyebrow block mb-2">Bio curta</label>
            <Input
              value={config.bio}
              onChange={(e) => setConfig((prev) => ({ ...prev, bio: e.target.value }))}
              placeholder="Ex: Painel VIP atualizado para Free Fire 2026"
              maxLength={240}
              className="h-12 rounded-2xl bg-white/5 border-white/10"
            />
          </div>

          <div>
            <label className="vip-eyebrow block mb-2">Texto falando sobre o painel</label>
            <Textarea
              value={config.description}
              onChange={(e) => setConfig((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Escreva novidades, instruções ou apresentação do painel…"
              rows={5}
              maxLength={3000}
              className="rounded-2xl bg-white/5 border-white/10 resize-none"
            />
          </div>

          <div className="space-y-3">
            <label className="vip-eyebrow block">Vídeo do painel</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["none", "Sem vídeo", Info],
                ["youtube", "YouTube", Youtube],
                ["gallery", "Galeria", Video],
              ] as [AboutVideoType, string, React.ElementType][]).map(([type, label, Icon]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, video_type: type }))}
                  className={`flex items-center justify-center gap-2 h-11 rounded-2xl text-xs font-semibold transition-colors ${
                    config.video_type === type ? "bg-white text-black" : "glass hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {config.video_type === "youtube" && (
              <div className="space-y-3">
                <Input
                  value={config.youtube_url}
                  onChange={(e) => setConfig((prev) => ({ ...prev, youtube_url: e.target.value }))}
                  placeholder="https://www.youtube.com/watch?v=... ou youtu.be/..."
                  className="h-12 rounded-2xl bg-white/5 border-white/10"
                />
                {youtubeEmbed ? (
                  <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <iframe
                      src={youtubeEmbed}
                      title="Prévia do vídeo do YouTube"
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : config.youtube_url.trim() ? (
                  <p className="text-xs text-status-danger">Link do YouTube inválido.</p>
                ) : null}
              </div>
            )}

            {config.video_type === "gallery" && (
              <div className="space-y-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/ogg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleVideoUpload(file);
                    e.currentTarget.value = "";
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    className="rounded-2xl border-white/10 bg-white/5"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    {uploading ? "Enviando vídeo…" : config.gallery_video_path ? "Trocar vídeo da galeria" : "Enviar vídeo da galeria"}
                  </Button>
                  {config.gallery_video_path && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={removeGalleryVideo}
                      className="rounded-2xl text-status-danger hover:bg-status-danger/15"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Remover
                    </Button>
                  )}
                </div>
                {config.gallery_video_name && (
                  <p className="text-xs text-muted-foreground truncate">Arquivo: {config.gallery_video_name}</p>
                )}
                {previewUrl && (
                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full max-h-72 rounded-2xl border border-white/10 bg-black"
                  />
                )}
              </div>
            )}
          </div>

          <Button
            onClick={() => void saveConfig()}
            disabled={saving || uploading}
            className="w-full h-12 rounded-2xl bg-white text-black hover:bg-white/90 font-bold uppercase tracking-[0.15em] text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? "Salvando…" : "Salvar sobre o painel"}
          </Button>
        </div>
      </section>

      <section className="glass-strong rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="vip-eyebrow">Avaliações</p>
            <h3 className="text-base font-bold">Feedbacks dos usuários ({feedbacks.length})</h3>
          </div>
        </div>

        {feedbacks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum feedback enviado ainda.</p>
        ) : (
          <ul className="space-y-2.5">
            {feedbacks.map((fb) => (
              <li key={fb.id} className="glass rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{fb.author_name}</span>
                      <span className="inline-flex items-center gap-0.5 text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < fb.rating ? "fill-current" : "opacity-25"}`} />
                        ))}
                      </span>
                    </div>
                    {fb.key && <p className="text-[11px] font-mono text-muted-foreground">{fb.key}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void removeFeedback(fb.id)}
                    aria-label="Excluir feedback"
                    className="w-8 h-8 rounded-xl shrink-0 hover:bg-status-danger/15 hover:text-status-danger"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{fb.comment}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {(fb.reward_coins ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-atlas-accent/10 px-2 py-1 text-[10px] font-semibold text-atlas-accent-bright">
                      <Coins className="h-3 w-3" /> Prêmio: +{fb.reward_coins} coins
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-lg px-2 text-[11px] text-atlas-cyan hover:bg-atlas-cyan/10"
                    onClick={() => {
                      setReplies((prev) => ({ ...prev, [fb.id]: prev[fb.id] ?? fb.admin_reply ?? "" }));
                      setReplyOpenId((current) => current === fb.id ? null : fb.id);
                    }}
                  >
                    <MessageSquareReply className="mr-1.5 h-3.5 w-3.5" />
                    {fb.admin_reply ? "Editar resposta" : "Responder"}
                  </Button>
                </div>
                {fb.admin_reply && replyOpenId !== fb.id && (
                  <div className="rounded-xl border border-atlas-cyan/20 bg-atlas-cyan/[0.06] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-atlas-cyan">Resposta do ADM</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs text-foreground/85">{fb.admin_reply}</p>
                  </div>
                )}
                {replyOpenId === fb.id && (
                  <div className="space-y-2 rounded-xl border border-atlas-cyan/20 bg-atlas-cyan/[0.04] p-3">
                    <Textarea
                      value={replies[fb.id] ?? ""}
                      onChange={(event) => setReplies((prev) => ({ ...prev, [fb.id]: event.target.value }))}
                      placeholder="Escreva uma resposta para este usuário…"
                      maxLength={1000}
                      rows={3}
                      aria-label={`Resposta para ${fb.author_name}`}
                      className="resize-none rounded-xl border-white/10 bg-background/60 text-sm"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">{(replies[fb.id] ?? "").length}/1000</span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={replyingId === fb.id || !isValidAdminFeedbackReply(replies[fb.id] ?? "")}
                        onClick={() => void replyToFeedback(fb.id)}
                        className="h-8 rounded-lg text-xs"
                      >
                        {replyingId === fb.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                        Publicar resposta
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/70">
                  {new Date(fb.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}