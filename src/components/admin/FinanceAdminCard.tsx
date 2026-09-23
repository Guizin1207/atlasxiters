import { useEffect, useMemo, useState } from "react";
import { BarChart3, DollarSign, Package, TrendingUp } from "lucide-react";
import { Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; name: string; price: number; sold: number; cost: number };

const DEFAULT_ROWS: Row[] = [
  { id: "basic", name: "Basic", price: 19.9, sold: 0, cost: 0 },
  { id: "pro", name: "Pro", price: 34.9, sold: 0, cost: 0 },
  { id: "master", name: "Master", price: 49.9, sold: 0, cost: 0 },
  { id: "bronze", name: "VIP Bronze", price: 29.9, sold: 0, cost: 0 },
  { id: "esmeralda", name: "VIP Esmeralda", price: 54.9, sold: 0, cost: 0 },
  { id: "rubi", name: "VIP Rubi", price: 79.9, sold: 0, cost: 0 },
  { id: "atlas", name: "VIP Atlas", price: 139.9, sold: 0, cost: 0 },
];

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FinanceAdminCard({ password }: { password: string }) {
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("atlas_admin_finance_costs");
      if (saved) {
        const costs = JSON.parse(saved) as Record<string, number>;
        setRows(DEFAULT_ROWS.map((row) => ({ ...row, cost: Number(costs[row.id] ?? 0) })));
      }
    } catch { /* mantém padrão */ }
  }, []);

  useEffect(() => {
    if (!password) return;
    let mounted = true;
    const load = async () => {
      const { data, error } = await supabase.rpc("admin_list_keys", { _password: password });
      if (!mounted || error) { setLoading(false); return; }
      const counts: Record<string, number> = {};
      for (const key of (data ?? []) as any[]) {
        const plan = String(key.plan ?? "").toLowerCase();
        if (plan && plan !== "demo" && plan !== "admin") counts[plan] = (counts[plan] ?? 0) + 1;
      }
      setRows((current) => current.map((row) => ({ ...row, sold: counts[row.id] ?? 0 })));
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, [password]);

  const saveCost = (id: string, value: number) => {
    const next = rows.map((row) => row.id === id ? { ...row, cost: value } : row);
    setRows(next);
    const costs = Object.fromEntries(next.map((row) => [row.id, row.cost]));
    localStorage.setItem("atlas_admin_finance_costs", JSON.stringify(costs));
  };

  const totals = useMemo(() => rows.reduce((acc, row) => {
    acc.sold += row.sold;
    acc.revenue += row.sold * row.price;
    acc.cost += row.sold * row.cost;
    return acc;
  }, { sold: 0, revenue: 0, cost: 0 }), [rows]);

  const chart = rows.map((row) => ({ name: row.name.replace("VIP ", ""), vendas: row.sold, faturamento: row.sold * row.price }));

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Produtos registrados", String(totals.sold), Package],
          ["Faturamento", money(totals.revenue), DollarSign],
          ["Custos", money(totals.cost), TrendingUp],
          ["Lucro estimado", money(totals.revenue - totals.cost), BarChart3],
        ].map(([label, value, Icon]) => (
          <div key={String(label)} className="glass-strong rounded-2xl p-4">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-black">{value}</p>
          </div>
        ))}
      </section>

      <section className="glass-strong rounded-3xl p-4 sm:p-5">
        <div className="mb-4">
          <p className="vip-eyebrow">Financeiro</p>
          <h3 className="text-lg font-bold">Produtos e vendas por plano</h3>
          <p className="text-xs text-muted-foreground">As vendas registradas são contabilizadas pelas keys comerciais criadas no sistema.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead><tr className="border-b border-white/10 text-left text-xs text-muted-foreground"><th className="p-3">Produto</th><th className="p-3">Preço</th><th className="p-3">Vendidos</th><th className="p-3">Faturamento</th><th className="p-3">Custo/un.</th><th className="p-3">Lucro</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const revenue = row.sold * row.price;
                const profit = revenue - row.sold * row.cost;
                return <tr key={row.id} className="border-b border-white/5">
                  <td className="p-3 font-semibold">{row.name}</td>
                  <td className="p-3">{money(row.price)}</td>
                  <td className="p-3 font-bold">{loading ? "…" : row.sold}</td>
                  <td className="p-3">{money(revenue)}</td>
                  <td className="p-3"><input type="number" min="0" step="0.01" value={row.cost} onChange={(e) => saveCost(row.id, Number(e.target.value) || 0)} className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 outline-none" /></td>
                  <td className="p-3 font-semibold">{money(profit)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-strong rounded-3xl p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4" /><div><p className="vip-eyebrow">Gráficos</p><h3 className="font-bold">Vendas por produto</h3></div></div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [value, "Vendas"]} />
              <Bar dataKey="vendas" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
