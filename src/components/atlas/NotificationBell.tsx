/**
 * Sino de notificações — badge com contador de não-lidas e
 * modal com histórico. Marca tudo como lido ao abrir.
 */
import { useEffect, useState } from "react";
import { Bell, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessages } from "@/hooks/use-messages";
import { useKey } from "@/lib/key-context";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { messages, unread, markAllRead } = useMessages();
  const { keyData } = useKey();
  const [open, setOpen] = useState(false);

  const alert = (() => {
    if (!keyData) return null;
    if (keyData.revoked)
      return {
        title: "Acesso encerrado",
        body: "Sua key foi excluída ou desativada. Fale com o suporte para reativar.",
      };
    if (
      !keyData.is_master &&
      keyData.expires_at &&
      new Date(keyData.expires_at).getTime() <= Date.now()
    )
      return {
        title: "Acesso expirado",
        body: "Sua key expirou. Fale com o suporte para renovar o acesso.",
      };
    return null;
  })();

  const totalUnread = unread + (alert ? 1 : 0);

  useEffect(() => {
    if (open && unread > 0) {
      const t = setTimeout(() => markAllRead(), 400);
      return () => clearTimeout(t);
    }
  }, [open, unread, markAllRead]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ""}`}
        onClick={() => setOpen(true)}
        className="w-10 h-10 rounded-2xl glass relative hover:bg-white/10"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 ? (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-status-danger text-white text-[10px] font-bold flex items-center justify-center animate-pulse-soft"
            aria-hidden
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : (
          <span
            aria-hidden
            className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-white/20"
          />
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-strong border-white/10 rounded-3xl max-w-md p-0 gap-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="vip-title text-base flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notificações
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] px-6 pb-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Inbox className="w-8 h-8 mb-3 opacity-50" />
                <p className="text-sm">Nenhuma mensagem ainda.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      "glass rounded-2xl p-4 space-y-1.5 animate-fade-in transition-all",
                      !m.is_read && "ring-1 ring-white/20"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold leading-tight">
                        {m.title}
                      </p>
                      {!m.is_read && (
                        <span
                          aria-label="Não lida"
                          className="shrink-0 mt-1 w-2 h-2 rounded-full bg-status-danger"
                        />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {m.body}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 pt-1">
                      {formatDistanceToNow(new Date(m.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                      {m.is_direct && " · Direta"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
