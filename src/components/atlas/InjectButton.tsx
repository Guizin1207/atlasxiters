import { useRef, useState } from "react";
import { Rocket, Loader2, CheckCircle2, FileText, Download, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { gameLaunchUrl, type GameVariant } from "@/lib/game-launch";

const FILE_READY_KEY = "atlas_injection_file_ready";
const TEST_FILE_URL = "/atlas-test-files/atlas-config-test.txt";

export function InjectButton() {
  const fallback = new URLSearchParams(window.location.search).get("game_fallback");
  const [open, setOpen] = useState(fallback === "normal" || fallback === "max");
  const [attempted, setAttempted] = useState(fallback === "normal" || fallback === "max");
  const [loadingGame, setLoadingGame] = useState<GameVariant | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileReady, setFileReady] = useState(() => localStorage.getItem(FILE_READY_KEY) === "1");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const markFileReady = () => {
    localStorage.setItem(FILE_READY_KEY, "1");
    setFileReady(true);
  };

  const chooseGame = (game: GameVariant) => {
    setAttempted(true);
    setLoadingGame(game);
    setSelectedFile(null);
    setFileText("");
    setLoaded(false);
    setProgress(0);
  };

  const handleDownload = () => {
    markFileReady();
    // O download acontece pelo navegador e o usuário permanece no Atlas.
    window.setTimeout(() => {
      setLoadingGame(null);
      setOpen(false);
    }, 300);
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".txt")) {
      setSelectedFile(null);
      return;
    }

    try {
      const text = await file.text();
      setSelectedFile(file);
      setFileText(text);
      markFileReady();

      const game = loadingGame;
      const href = game ? gameLaunchUrl(game, navigator.userAgent, window.location.href) : null;
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

  const resetDownload = () => {
    localStorage.removeItem(FILE_READY_KEY);
    setFileReady(false);
  };

  return <>
    <input ref={fileInputRef} type="file" accept=".txt,text/plain" className="hidden" onChange={handleFile} />

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
          <DialogTitle>{loadingGame ? "Arquivo necessário" : "Escolha o jogo"}</DialogTitle>
          <DialogDescription>
            {loadingGame ? "Baixe o arquivo uma vez. Depois, volte ao Atlas e selecione o TXT." : "Toque na versão instalada para continuar."}
          </DialogDescription>
        </DialogHeader>

        {loadingGame ? (
          <div className="py-5 text-center space-y-4">
            {!selectedFile && !loaded ? (
              <>
                {!fileReady ? (
                  <a
                    href={TEST_FILE_URL}
                    download="atlas-config-test.txt"
                    onClick={handleDownload}
                    className="w-full h-16 rounded-2xl bg-white text-black flex items-center justify-center gap-3 font-bold"
                  >
                    <Download className="w-5 h-5" /> Baixar arquivo necessário
                  </a>
                ) : (
                  <div className="rounded-2xl glass p-4 text-left">
                    <p className="font-bold">Arquivo já baixado</p>
                    <p className="text-xs text-muted-foreground mt-1">Este dispositivo já foi registrado. Não é necessário baixar novamente.</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-16 rounded-2xl glass flex items-center justify-center gap-3 font-bold text-sm"
                >
                  <FileText className="w-5 h-5" />
                  {fileReady ? "Selecionar arquivo .TXT" : "Depois do download, selecionar TXT"}
                </button>

                {fileReady && (
                  <button type="button" onClick={resetDownload} className="mx-auto text-xs text-muted-foreground flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Refazer download
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="relative mx-auto w-20 h-20 rounded-full glass flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-white/10 border-t-white animate-spin" />
                  {loaded ? <CheckCircle2 className="w-8 h-8 animate-in zoom-in" /> : <Loader2 className="w-8 h-8 animate-spin" />}
                </div>
                <div>
                  <p className="font-bold">{loaded ? "Arquivos carregados" : "Lendo e carregando arquivos..."}</p>
                  <p className="text-xs text-muted-foreground mt-1">{loaded ? "Abrindo o jogo..." : selectedFile?.name || "Preparando os arquivos para iniciar."}</p>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-white transition-[width] duration-100" style={{ width: `${loaded ? 100 : progress}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground">{fileText.length.toLocaleString("pt-BR")} caracteres lidos</p>
              </>
            )}
          </div>
        ) : null}

        <div className={loadingGame ? "hidden" : "grid grid-cols-2 gap-3 pt-1"}>
          {(["normal", "max"] as GameVariant[]).map(game => (
            <button key={game} type="button" onClick={() => chooseGame(game)} className="h-24 rounded-2xl glass flex flex-col items-center justify-center gap-2 font-bold text-sm hover:bg-white/10 active:scale-[0.98] transition-all">
              <Rocket className="w-5 h-5" />{game === "max" ? "Free Fire MAX" : "Free Fire"}
            </button>
          ))}
        </div>

        {attempted && !loadingGame && (
          <p role="status" className="text-sm text-muted-foreground">Se o jogo não abrir, abra-o pelo ícone no aparelho. Alguns navegadores não permitem abertura por link.</p>
        )}
      </DialogContent>
    </Dialog>
  </>;
}
