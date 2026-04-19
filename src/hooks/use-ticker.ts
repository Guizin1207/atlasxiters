/**
 * Hook utilitário: re-renderiza a cada `intervalMs` (default 1s).
 * Usado pelo contador regressivo ao vivo.
 */
import { useEffect, useState } from "react";

export function useTicker(intervalMs = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
