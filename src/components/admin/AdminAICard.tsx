/**
 * IA administrativa: conversa única (salva no Lovable Cloud) capaz de propor
 * criação, edição, remoção e reordenação das funções do painel.
 * Nada é aplicado sem o administrador confirmar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput } from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import { usePanelFunctions } from "@/hooks/use-panel-functions";
import { PanelProposalCard, type PanelProposal } from "./PanelProposalCard";
import atlasAiLogo from "@/assets/atlas-ai-logo.png";

const FUNCTION_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/admin-ai`;

const SUGGESTIONS = [
  "Crie uma função de Turbo FPS no plano pro",
  "Mude o Radar para o plano basic",
  "Coloque o Aim Assist como primeira função",
];

export function AdminAICard() {
  const { password } = useAdmin();
  const source = useMemo(() => (password ? { password } : null), [password]);
  const { functions } = usePanelFunctions(source);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const snapshot = useMemo(
    () =>
      functions
        .map(
          (f) =>
            `- ${f.id} | ${f.name} | ${f.tag} | plano ${f.minPlan} | ícone ${f.icon} | posição ${f.sortOrder}${
              f.visible ? "" : " | oculta"
            }`,
        )
        .join("\n"),
    [functions],
  );
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  // Histórico único, guardado no Lovable Cloud.
  useEffect(() => {
    if (!password) return;
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.rpc("admin_get_ai_messages", {
        _password: password,
      });
      if (!mounted) return;
      setInitialMessages(!error && Array.isArray(data) ? (data as unknown as UIMessage[]) : []);
    })();
    return () => {
      mounted = false;
    };
  }, [password]);

  const persist = useCallback(
    async (msgs: UIMessage[]) => {
      if (!password) return;
      const { error } = await supabase.rpc("admin_save_ai_messages", {
        _password: password,
        _messages: msgs.slice(-60) as never,
      });
      if (error) toast.error("A conversa não pôde ser salva na nuvem.");
    },
    [password],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: FUNCTION_URL,
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, password, functions: snapshotRef.current },
        }),
      }),
    [password],
  );

  return initialMessages === null ? (
    <section className="glass-strong rounded-2xl h-64 flex items-center justify-center">
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    </section>
  ) : (
    <AdminAIChat
      key={initialMessages.length === 0 ? "empty" : "loaded"}
      initialMessages={initialMessages}
      transport={transport}
      persist={persist}
      password={password ?? ""}
      input={input}
      setInput={setInput}
      textareaRef={textareaRef}
      onClear={async () => {
        await persist([]);
        setInitialMessages([]);
      }}
    />
  );
}

function AdminAIChat({
  initialMessages,
  transport,
  persist,
  password,
  input,
  setInput,
  textareaRef,
  onClear,
}: {
  initialMessages: UIMessage[];
  transport: DefaultChatTransport<UIMessage>;
  persist: (messages: UIMessage[]) => Promise<void>;
  password: string;
  input: string;
  setInput: (value: string) => void;
  textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  onClear: () => Promise<void>;
}) {
  const { messages, sendMessage, status, stop, error } = useChat({
    id: "atlas-admin-ai",
    messages: initialMessages,
    transport,
    onFinish: ({ messages: all }) => {
      persist(all);
      textareaRef.current?.focus();
    },
  });

  useEffect(() => {
    textareaRef.current?.focus();
  }, [textareaRef]);

  const busy = status === "submitted" || status === "streaming";

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    sendMessage({ text: value });
    setInput("");
  };

  return (
    <section className="glass-strong rounded-2xl overflow-hidden" aria-label="IA do painel">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={atlasAiLogo}
            alt="IA do Atlas"
            loading="lazy"
            width={816}
            height={816}
            className="w-8 h-8 object-contain"
          />
          <div className="min-w-0">
            <p className="vip-eyebrow">IA do painel</p>
            <h2 className="font-bold text-sm leading-none">Criar e modificar funções</h2>
          </div>
        </div>
        <Button
          variant="ghost"
          onClick={onClear}
          className="rounded-xl glass hover:bg-white/10 text-xs"
          aria-label="Limpar conversa"
        >
          <RotateCcw className="w-3.5 h-3.5 sm:mr-2" />
          <span className="hidden sm:inline">Limpar</span>
        </Button>
      </header>

      <Conversation className="h-[26rem]">
        <ConversationContent className="gap-6">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Peça uma mudança no painel"
              description="Ex: crie uma função de Turbo FPS no plano pro."
            >
              <div className="space-y-3 w-full max-w-sm">
                <p className="text-sm text-muted-foreground text-center">
                  Peça uma mudança no painel. Você confirma antes de aplicar.
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="glass rounded-xl px-3 py-2 text-xs text-left hover:bg-white/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return (
                        <MessageResponse key={`${message.id}-t-${i}`}>{part.text}</MessageResponse>
                      );
                    }
                    if (part.type === "reasoning" && part.text) {
                      return (
                        <p
                          key={`${message.id}-r-${i}`}
                          className="text-[11px] text-muted-foreground italic"
                        >
                          {part.text}
                        </p>
                      );
                    }
                    if (part.type === "tool-propor_mudanca_painel") {
                      const proposal = part.input as PanelProposal | undefined;
                      return (
                        <div key={`${message.id}-p-${i}`} className="space-y-2">
                          <Tool defaultOpen={false}>
                            <ToolHeader
                              title="Proposta de mudança"
                              type="tool-propor_mudanca_painel"
                              state={part.state}
                            />
                            <ToolContent>
                              <ToolInput input={part.input} />
                            </ToolContent>
                          </Tool>
                          {part.state === "output-available" && proposal && (
                            <PanelProposalCard proposal={proposal} password={password} />
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}

          {status === "submitted" && <Shimmer>Pensando...</Shimmer>}

          {error && (
            <p className="text-xs text-status-danger">
              {error.message || "A IA não respondeu. Tente de novo."}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="p-3 border-t border-white/10">
        <PromptInput
          onSubmit={(message, event) => {
            event.preventDefault();
            submit(message.text ?? input);
          }}
        >
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: crie uma função de Turbo FPS no plano pro"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit
              status={status}
              disabled={!input.trim() && !busy}
              onStop={stop}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  );
}
