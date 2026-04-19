import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ListFilter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/lib/admin-context";
import type { KeyData } from "@/lib/key-context";
import { getKeyStatus, type KeyStatus } from "@/lib/key-status";
import { KeyRowItem } from "./KeyRowItem";
import { cn } from "@/lib/utils";

type Filter = "all" | KeyStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "active", label: "Ativas" },
  { id: "unused", label: "Não usadas" },
  { id: "expired", label: "Expiradas" },
  { id: "revoked", label: "Revogadas" },
];

export function KeysListCard() {
  const { password } = useAdmin();
  const [keys, setKeys] = useState<KeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (!password) return;
    const { data, error } = await supabase.rpc("admin_list_keys", {
      _password: password,
    });
    if (!error) setKeys((data ?? []) as unknown as KeyData[]);
    setLoading(false);
  }, [password]);

  useEffect(() => {
    load();
    const onChange = () => load();
    window.addEventListener("atlas:keys-changed", onChange);
    return () => window.removeEventListener("atlas:keys-changed", onChange);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return keys.filter((k) => {
      if (filter !== "all" && getKeyStatus(k) !== filter) return false;
      if (!q) return true;
      return (
        k.key.toLowerCase().includes(q) ||
        (k.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [keys, filter, query]);

  return (
    <section className="glass-strong rounded-3xl p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="vip-eyebrow mb-1">Catálogo</p>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ListFilter className="w-4 h-4" />
            Chaves cadastradas
          </h2>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar chave ou nota…"
            className="pl-9 rounded-xl bg-white/5 border-white/10 h-10"
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.id === "all"
              ? keys.length
              : keys.filter((k) => getKeyStatus(k) === f.id).length;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 h-8 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2",
                active
                  ? "bg-white text-black"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "tabular-nums text-[10px]",
                  active ? "text-black/60" : "text-muted-foreground/60"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="h-32 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
          Nenhuma chave encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((k) => (
            <KeyRowItem key={k.id} data={k} onChanged={load} />
          ))}
        </div>
      )}
    </section>
  );
}
