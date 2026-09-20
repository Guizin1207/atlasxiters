import { useKey } from "@/lib/key-context";

/** A validação e o relógio são únicos, no provider; o aviso usa o mesmo estado. */
export function useKeyValidity() {
  const { expiredKey } = useKey();
  return { expired: Boolean(expiredKey) };
}
