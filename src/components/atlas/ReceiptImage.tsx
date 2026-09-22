import { useEffect, useState } from "react";
import { resolveReceiptUrl, type ReceiptAuth } from "@/lib/receipts";

export function ReceiptImage({ refValue, caption, auth }: { refValue: string; caption: string; auth: ReceiptAuth }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    resolveReceiptUrl(refValue, auth).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [refValue, auth.key, auth.password]);

  if (!url) return <span className="text-[10px] opacity-60">Carregando comprovante…</span>;

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt="Comprovante" className="max-h-56 w-auto rounded-xl object-contain" />
      <span className="mt-1 block text-[10px] opacity-60">{caption}</span>
    </a>
  );
}
