import { useRef, useState } from "react";
import { Rocket, Loader2, CheckCircle2, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { gameLaunchUrl, type GameVariant } from "@/lib/game-launch";

/** O navegador lê somente o TXT escolhido pelo usuário e tenta abrir o jogo. */
export function InjectButton() {
  const fallback = new URLSearchParams(window.location.search).get("game_fallback");
  const [open, setOpen] = useState(fallback === "normal" || fallback === "max");
  const [attempted, setAttempted] = useState(fallback === "normal" || fallback === "max");
  const [loadingGame, setLoadingGame] = useState<GameVariant | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chooseGame = (game: GameVariant) => {
    setAttempted(true);
    setLoadingGame(game);
    setSelectedFile(null);
    setFileText("");
    setLoaded(false);
    setProgress(0);
    requestAnimationFrame(() => fileInputRef.current?.click());
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      setLoadingGame(null);
      return;
    }

    if (!file.name.toLowerCase().endsWith(".txt")) {
      setLoadingGame(null);
      return;
    }

    try {
      const text = await file.text();
      setSelectedFile(file);
      setFileText(text);

      const href = loadingGame ? gameLaunchUrl(loadingGame, navigator.userAgent, window.location.href) : null;
      const started = performance.now();
      const duration = 3200;

      const tick = (time: number) => {
        const value = Math.min(100, ((time - started) / duration) * 100);
        setProgress(value);

        if (value < 100) {
          requestAnimationFrame(tick);
        } else {
          setLoaded(true);
          window.setTimeout(() => {
            if (href) window.location.href = href;
          }, 1200);
        }
      };

      requestAnimationFrame(tick);
    } catch {
      setLoadingGame(null);
      setSelectedFile(null);
      setFileText("");
    }
  };

  return <>
    <input
      ref={fileInputRef}
      type="file"
      accept=".txt,text/plain"
      className="hidden"
      onChange={handleFile}
    />

    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 px-5 w-full max-w-md">
      <button
        type="button"
        onClick={() => { setOpen(true); setLoaded(false); setLoadingGame(null); setProgress(0); }}
        className="w-full h-16 rounded-2xl bg-white text-black font-bold uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 shadow-elevated active:scale-[0.98] transition-transform"
      >
        <Rocket className="w-4 h-4" /> Injetar
      </button>
    </div>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rounded-3xl max-w-sm">
        <DialogHeader>
          <DialogTitle>{loadingGame ? "Escolha o arquivo" : "Escolha o jogo"}</DialogTitle>
          <DialogDescription>
            {loadingGame ? "Selecione o arquivo TXT do dispositivo para continuar." : "Toque na versão instalada para continuar."}
          </DialogDescription>
        </DialogHeader>

        {loadingGame ? (
          <div className="py-8 text-center space-y-5">
            {!selectedFile && !loaded ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-28 rounded-2xl glass flex flex-col items-center justify-center gap-3 font-bold text-sm"
              >
                <FileText className="w-8 h-8" />
                Selecionar arquivo .TXT
              </button>
            ) : (
              <>
                <div className="relative mx-auto w-20 h-20 rounded-full glass flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-white/10 border-t-white animate-spin" />
                  {loaded ? <CheckCircle2 className="w-8 h-8 animate-in zoom-in" /> : <Loader2 className="w-8 h-8 animate-spin" />}
                </div>
                <div>
                  <p className="font-bold">{loaded ? "Arquivos carregados" : "Lendo e carregando arquivos..."}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {loaded ? "Abrindo o jogo..." : selectedFile ? selectedFile.name : "Preparando os arquivos para iniciar."}
                  </p>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-white transition-[width] duration-100" style={{ width: `${loaded ? 100 : progress}%` }} />
                </div>
              </>
            )}
          </div>
        ) : null}

        <div className={loadingGame ? "hidden" : "grid grid-cols-2 gap-3 pt-1"}>
          {(["normal", "max"] as GameVariant[]).map(game => (
            <button
              key={game}
              type="button"
              onClick={() => chooseGame(game)}
              className="h-24 rounded-2xl glass flex flex-col items-center justify-center gap-2 font-bold text-sm hover:bg-white/10 active:scale-[0.98] transition-all"
            >
              <Rocket className="w-5 h-5" />{game === "max" ? "Free Fire MAX" : "Free Fire"}
            </button>
          ))}
        </div>

        {attempted && !loadingGame && (
          <p role="status" className="text-sm text-muted-foreground">
            Se o jogo não abrir, abra-o pelo ícone no aparelho. Alguns navegadores não permitem abertura por link.
          </p>
        )}
      </DialogContent>
    </Dialog>
  </>;
}
