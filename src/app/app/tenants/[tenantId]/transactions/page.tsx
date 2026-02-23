"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Transaction = {
  id: string;
  date: string;
  description: string;
  category_id: string;
  amount: number;
  entity_id: string | null;
  status: string;
  created_at: string;
};

type Category = {
  category_id: string;
  category_name: string;
  type: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TX_STATUSES = ["Planned", "Sent", "Received", "Paid", "Cancelled", "Reconciled"] as const;

const STATUS_COLORS: Record<string, string> = {
  Planned:    "bg-zinc-100 text-zinc-600",
  Sent:       "bg-blue-100 text-blue-700",
  Received:   "bg-sky-100 text-sky-700",
  Paid:       "bg-green-100 text-green-700",
  Cancelled:  "bg-red-100 text-red-700",
  Reconciled: "bg-purple-100 text-purple-700",
};

function fmtDate(d: string) {
  try { return format(new Date(d + "T12:00:00"), "MMM d, yyyy"); }
  catch { return d; }
}

function fmtAmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [tenantName, setTenantName]   = useState("");
  const [txs, setTxs]                 = useState<Transaction[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch]           = useState("");
  const [updating, setUpdating]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setError("Missing Supabase env vars."); setLoading(false); return; }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/login"); return; }

    const [tenantRes, txRes, catRes] = await Promise.all([
      supabase.from("tenants").select("name").eq("id", tenantId).single(),
      supabase.from("transactions").select("id,date,description,category_id,amount,entity_id,status,created_at").eq("tenant_id", tenantId).order("date", { ascending: false }),
      supabase.from("categories").select("category_id,category_name,type").eq("tenant_id", tenantId),
    ]);

    if (tenantRes.error || !tenantRes.data) { setError("Tenant not found."); setLoading(false); return; }
    setTenantName(tenantRes.data.name);
    setTxs(txRes.data ?? []);
    setCategories(catRes.data ?? []);
    setLoading(false);
  }, [supabase, tenantId, router]);

  useEffect(() => { load(); }, [load]);

  const catMap = Object.fromEntries(categories.map((c) => [c.category_id, c]));

  const filtered = txs.filter((t) => {
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q || t.description.toLowerCase().includes(q) || t.category_id.toLowerCase().includes(q) || (catMap[t.category_id]?.category_name ?? "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  async function handleStatusChange(id: string, newStatus: string) {
    if (!supabase) return;
    setUpdating(id);
    await supabase.from("transactions").update({ status: newStatus }).eq("id", id);
    setTxs((prev) => prev.map((t) => t.id === id ? { ...t, status: newStatus } : t));
    setUpdating(null);
  }

  // CSV export
  function exportCSV() {
    const rows = [["Date", "Description", "Category", "Amount", "Entity", "Status"]];
    filtered.forEach((t) => {
      rows.push([
        t.date,
        `"${t.description.replace(/"/g, '""')}"`,
        catMap[t.category_id]?.category_name ?? t.category_id,
        String(t.amount),
        t.entity_id ?? "",
        t.status,
      ]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${tenantId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 space-y-3">
        <div className="h-5 w-48 bg-zinc-100 rounded animate-pulse" />
        <div className="h-12 bg-zinc-100 rounded-xl animate-pulse" />
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-zinc-100 rounded animate-pulse" />)}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-zinc-500">
        <Link href="/app" className="hover:underline">Tenants</Link>{" "}
        /{" "}
        <Link href={`/app/tenants/${tenantId}`} className="hover:underline">{tenantName || tenantId}</Link>{" "}
        / <span className="text-zinc-900 font-medium">Transactions</span>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold text-zinc-900">Transactions</h1>
        <Button variant="secondary" onClick={exportCSV} disabled={filtered.length === 0}>
          Export CSV
        </Button>
      </div>

      {error && <Card><p className="text-sm text-red-700">{error}</p></Card>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search description or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-md border border-[#2a2a2a] bg-[#141414] text-[#f0f0f0] placeholder:text-[#505050] px-3 py-2 text-sm outline-none focus:border-[#0057ff] transition-colors"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-[#2a2a2a] bg-[#141414] text-[#f0f0f0] px-3 py-2 text-sm outline-none focus:border-[#0057ff] transition-colors"
        >
          <option value="all">All statuses</option>
          {TX_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-sm text-zinc-400 shrink-0">{filtered.length} of {txs.length}</span>
      </div>

      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-10">
            {txs.length === 0 ? "No transactions recorded yet." : "No transactions match your filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide text-right">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, idx) => {
                  const cat = catMap[t.category_id];
                  const isRev = cat?.type === "Rev";
                  return (
                    <tr key={t.id} className={`border-b border-[#1a1a1a] hover:bg-[#161616] transition-colors ${idx % 2 === 0 ? "" : "bg-[#0f0f0f]"}`}>
                      <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="px-4 py-3 text-zinc-900 max-w-xs truncate">{t.description}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {cat ? (
                          <span className="flex items-center gap-1.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cat.type === "Rev" ? "bg-green-50 text-green-700" : cat.type === "Exp" ? "bg-red-50 text-red-700" : "bg-zinc-100 text-zinc-500"}`}>
                              {cat.type}
                            </span>
                            {cat.category_name}
                          </span>
                        ) : (
                          <span className="text-zinc-400">{t.category_id}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap ${isRev ? "text-green-700" : "text-zinc-900"}`}>
                        {isRev ? "+" : ""}{fmtAmt(t.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={t.status}
                          disabled={updating === t.id}
                          onChange={(e) => handleStatusChange(t.id, e.target.value)}
                          className="text-xs border border-[#2a2a2a] rounded px-2 py-1 bg-[#141414] text-[#d0d0d0] outline-none focus:border-[#0057ff] disabled:opacity-40 transition-colors"
                        >
                          {TX_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
