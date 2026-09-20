import { useEffect, useState } from "react";
import { resolveReceiptUrl } from "@/lib/receipts";

export function ReceiptImage({ ref: _unused, refValue, caption }: { ref?: never; refValue: string; caption: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    resolveReceiptUrl(refValue).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [refValue]);

  if (!url) return <span className="text-[10px] opacity-60">Carregando comprovante…</span>;

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt="Comprovante" className="max-h-56 w-auto rounded-xl object-contain" />
      <span className="mt-1 block text-[10px] opacity-60">{caption}</span>
    </a>
  );
}
