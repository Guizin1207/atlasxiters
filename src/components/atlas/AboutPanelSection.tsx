import { useCallback, useEffect, useState } from "react";
import { Coins, Info, Loader2, MessageSquareReply, Send, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useKey } from "@/lib/key-context";
import {
  DEFAULT_ABOUT_PANEL,
  extractYouTubeEmbedUrl,
  resolvePanelVideoUrl,
  getGrantedFeedbackCoins,
  type AboutPanelConfig,
  type PanelFeedbackList,
  type PanelFeedbackSubmission,
} from "@/lib/about-panel";

export function AboutPanelSection() {
  const { keyData } = useKey();
  const accessKey = keyData?.key ?? "";
  const [about, setAbout] = useState<AboutPanelConfig>(DEFAULT_ABOUT_PANEL);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<PanelFeedbackList>({ items: [], total: 0, average: 0 });
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [authorName, setAuthorName] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const loadAbout = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_about_panel");
    if (!error && data) {
      const next = { ...DEFAULT_ABOUT_PANEL, ...(data as Partial<AboutPanelConfig>) };
      setAbout(next);
      if (next.video_type === "gallery" && next.gallery_video_path && accessKey) {
        const url = await resolvePanelVideoUrl(next.gallery_video_path, { key: accessKey });
        setVideoUrl(url);
      } else {
        setVideoUrl(null);
      }
    }
  }, [accessKey]);

  const loadFeedbacks = useCallback(async () => {
    if (!accessKey) return;
    const { data, error } = await supabase.rpc("list_panel_feedbacks", { _key: accessKey });
    if (!error && data) {
      const parsed = data as Partial<PanelFeedbackList>;
      setFeedbacks({
        items: Array.isArray(parsed.items) ? parsed.items : [],
        total: Number(parsed.total ?? 0),
        average: Number(parsed.average ?? 0),
      });
    }
  }, [accessKey]);

  useEffect(() => {
    let active = true;
    void Promise.all([loadAbout(), loadFeedbacks()]).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [loadAbout, loadFeedbacks]);

  useEffect(() => {
    const channel = supabase
      .channel("about-panel-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_config" }, () => {
        void loadAbout();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "panel_feedbacks" }, () => {
        void loadFeedbacks();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAbout, loadFeedbacks]);

  const submitFeedback = async () => {
    if (!accessKey || sending) return;
    const clean = comment.trim();
    if (clean.length < 3) {
      toast.error("Escreva pelo menos 3 caracteres no seu feedback.");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.rpc("submit_panel_feedback", {
      _key: accessKey,
      _rating: rating,
      _comment: clean,
      _author_name: authorName.trim() || undefined,
    });
    setSending(false);
    if (error) {
      toast.error(error.message || "Não foi possível enviar o feedback.");
      return;
    }
    const coins = getGrantedFeedbackCoins(data as PanelFeedbackSubmission | null);
    setComment("");
    setRating(5);
    if (coins > 0) {
      toast.success(`Feedback enviado! Você ganhou +${coins} Atlas Coins.`);
    } else {
      toast.success("Feedback enviado! O prêmio de hoje já foi recebido.");
    }
    void loadFeedbacks();
  };

  const youtubeEmbed = about.video_type === "youtube" ? extractYouTubeEmbedUrl(about.youtube_url) : null;

  if (loading) {
    return (
      <div className="glass-strong rounded-2xl p-5 flex justify-center py-8">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="glass-strong rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl glass flex items-center justify-center shrink-0">
          <Info className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="vip-eyebrow">Sobre o painel</p>
          <h3 className="text-base font-bold truncate">Sobre o aplicativo</h3>
        </div>
      </div>

      {youtubeEmbed && (
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
          <iframe
            src={youtubeEmbed}
            title="Vídeo do painel"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {about.video_type === "gallery" && videoUrl && (
        <video
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          className="w-full max-h-72 rounded-2xl border border-white/10 bg-black"
        />
      )}

      {about.bio && (
        <p className="text-sm font-semibold leading-relaxed">{about.bio}</p>
      )}

      {about.description && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {about.description}
        </p>
      )}

      <div className="border-t border-white/10 pt-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="vip-eyebrow">Comunidade</p>
            <h4 className="text-sm font-bold">Feedback do app</h4>
          </div>
          {feedbacks.total > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold">
              <Star className="w-3.5 h-3.5 fill-current text-foreground" />
              <span>{feedbacks.average.toFixed(1)}</span>
              <span className="text-muted-foreground">({feedbacks.total})</span>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3.5 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-atlas-accent/20 bg-atlas-accent/[0.07] px-3 py-2 text-xs text-atlas-accent-bright">
            <Coins className="h-4 w-4 shrink-0" />
            <span>O primeiro feedback do dia vale <strong>+25 Atlas Coins</strong>.</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Sua nota</span>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Nota do aplicativo">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  aria-label={`${star} ${star === 1 ? "estrela" : "estrelas"}`}
                  className="p-1 transition-transform active:scale-95"
                >
                  <Star
                    className={`w-5 h-5 ${star <= rating ? "fill-current text-foreground" : "text-muted-foreground/40"}`}
                  />
                </button>
              ))}
            </div>
          </div>

          <Input
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Seu nome (opcional)"
            maxLength={40}
            className="h-10 rounded-xl bg-white/5 border-white/10 text-sm"
          />

          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Conte o que achou do painel…"
            rows={3}
            maxLength={500}
            className="rounded-xl bg-white/5 border-white/10 resize-none text-sm"
          />

          <Button
            type="button"
            onClick={() => void submitFeedback()}
            disabled={sending || comment.trim().length < 3}
            className="w-full h-10 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-bold uppercase tracking-[0.12em]"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-2" />}
            {sending ? "Enviando…" : "Enviar feedback"}
          </Button>
        </div>

        {feedbacks.items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            Seja o primeiro a deixar um feedback do app.
          </p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {feedbacks.items.map((fb) => (
              <li key={fb.id} className="rounded-xl bg-white/[0.03] border border-white/10 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate">{fb.author_name}</span>
                  <span className="inline-flex items-center gap-0.5 text-foreground shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < fb.rating ? "fill-current" : "opacity-25"}`} />
                    ))}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{fb.comment}</p>
                {(fb.reward_coins ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-atlas-accent/10 px-2 py-1 text-[10px] font-semibold text-atlas-accent-bright">
                    <Coins className="h-3 w-3" /> +{fb.reward_coins} Atlas Coins
                  </span>
                )}
                {fb.admin_reply && (
                  <div className="mt-2 rounded-xl rounded-tl-sm border border-atlas-cyan/20 bg-atlas-cyan/[0.06] p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-atlas-cyan">
                      <MessageSquareReply className="h-3.5 w-3.5" /> Resposta do ADM
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/85">{fb.admin_reply}</p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/70">
                  {new Date(fb.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}