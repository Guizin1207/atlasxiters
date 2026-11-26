import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import {
  DOWNLOAD_FILE_MAX_BYTES,
  deleteManagedDownload,
  isValidDownloadTextFile,
  uploadManagedDownload,
  type DownloadFileConfig,
} from "@/lib/app-download";

export function DownloadFileAdminCard() {
  const { password } = useAdmin();
  const fileRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<DownloadFileConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_download_file");
    if (error) toast.error("Não foi possível carregar o arquivo atual.", { description: error.message });
    else setConfig(data as DownloadFileConfig);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFile = async (file: File) => {
    if (!password || uploading) return;
    if (!isValidDownloadTextFile(file)) {
      toast.error("Selecione um arquivo TXT não vazio de até 10 MB.");
      return;
    }

    setUploading(true);
    try {
      const previousPath = config?.path ?? "";
      const saved = await uploadManagedDownload(password, file);
      setConfig(saved);
      if (previousPath && previousPath !== saved.path) {
        const removed = await deleteManagedDownload(password, previousPath);
        if (!removed) toast.warning("O novo arquivo está ativo, mas o anterior não pôde ser removido.");
      }
      toast.success("Arquivo substituído. O botão dos usuários já oferece a versão mais recente.");
    } catch (error) {
      toast.error("Não foi possível substituir o arquivo.", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="glass-strong rounded-3xl p-6 space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl glass flex items-center justify-center">
          <Download className="w-4 h-4" />
        </div>
        <div>
          <p className="vip-eyebrow">Botão do painel</p>
          <h2 className="vip-title text-base leading-none">Gerenciar arquivo de download</h2>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="glass rounded-2xl p-4 flex items-start gap-3">
            <FileText className="w-5 h-5 mt-0.5 shrink-0 text-atlas-cyan" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Arquivo disponibilizado agora</p>
              <p className="mt-1 font-semibold break-all">{config?.file_name || "atlas-config-test.txt"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {config?.path ? "Enviado pelo ADM" : "Arquivo padrão do sistema"}
                {config?.file_size ? ` · ${(config.file_size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB` : ""}
              </p>
              {config?.updated_at && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Atualizado em {new Date(config.updated_at).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            disabled={uploading || !password}
            onClick={() => fileRef.current?.click()}
            className="w-full h-12 rounded-2xl font-bold"
          >
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? "Enviando e substituindo…" : config?.path ? "Enviar novo arquivo e substituir" : "Enviar arquivo personalizado"}
          </Button>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-atlas-accent-bright" />
            <p>Somente TXT de até {(DOWNLOAD_FILE_MAX_BYTES / 1024 / 1024).toFixed(0)} MB. Depois da substituição, o botão “Baixar arquivo necessário” entrega somente a versão mais recente.</p>
          </div>
        </>
      )}
    </section>
  );
}
