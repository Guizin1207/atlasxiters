/**
 * Revalida periodicamente a chave atual contra o backend.
 * Quando volta erro (expirou, revogada, device errado), o KeyProvider já limpa o storage.
 * Aqui apenas exporta um booleano `expired` para os modais reagirem.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useKey } from "@/lib/key-context";

export function useKeyValidity(intervalMs = 30_000) {
  const { keyData, deviceId, refresh } = useKey();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!keyData) {
      setExpired(false);
      return;
    }

    let mounted = true;
    const check = async () => {
      const { error } = await supabase.rpc("validate_key", {
        _key: keyData.key,
        _device_id: deviceId,
      });
      if (!mounted) return;
      if (error) {
        setExpired(error.message.toLowerCase().includes("expired_key"));
        // não chama refresh aqui — o ExpiredKeyModal cuida do logout final
      } else {
        // mantém os dados frescos (ex.: expires_at atualizado)
        refresh();
      }
    };

    check();
    const id = setInterval(check, intervalMs);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [keyData, deviceId, intervalMs, refresh]);

  return { expired };
}
