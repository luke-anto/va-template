"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type TenantRow = {
  id: string;
  name: string;
  package_tier: "foundation" | "growth" | "cfo_lite";
  niche: string | null;
};

type TenantUserRow = {
  role: string;
  tenants: TenantRow | TenantRow[] | null;
};

type CycleRow = {
  id: string;
  tenant_id: string;
  month: string;
  status: string;
};

const TIER_LABEL: Record<string, string> = {
  foundation: "Foundation",
  growth: "Growth",
  cfo_lite: "CFO-Lite",
};

const TIER_COLORS: Record<string, string> = {
  foundation: "bg-zinc-100 text-zinc-700",
  growth: "bg-blue-100 text-blue-700",
  cfo_lite: "bg-violet-100 text-violet-700",
};

const CYCLE_STATUS_COLORS: Record<string, string> = {
  collecting: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  reconciling: "bg-indigo-100 text-indigo-700",
  reporting: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  paused: "bg-zinc-100 text-zinc-500",
};

function currentMonthDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export default function AppHomePage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [rows, setRows] = useState<TenantUserRow[] | null>(null);
  const [cycles, setCycles] = useState<Record<string, CycleRow>>({});
  const [startingCycle, setStartingCycle] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const month = currentMonthDate();

  const loadCycles = useCallback(async (tenantIds: string[]) => {
    if (!supabase || tenantIds.length === 0) return;
    const { data } = await supabase
      .from("service_cycles")
      .select("id, tenant_id, month, status")
      .eq("month", month)
      .in("tenant_id", tenantIds);
    if (data) {
      const map: Record<string, CycleRow> = {};
      for (const row of data) map[row.tenant_id] = row;
      setCycles(map);
    }
  }, [supabase, month]);

  useEffect(() => {
    if (!supabase) {
      setError("Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    let cancelled = false;
    async function run() {
      const { data: userData } = await supabase!.auth.getUser();
      if (!userData.user) { router.replace("/login"); return; }

      const { data, error: loadErr } = await supabase!
        .from("tenant_users")
        .select("role, tenants ( id, name, package_tier, niche )")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (loadErr) { setError(loadErr.message); return; }

      const tenantUserRows = (data ?? []) as unknown as TenantUserRow[];
      setRows(tenantUserRows);

      const tenantIds = tenantUserRows
        .map((r) => {
          const t = Array.isArray(r.tenants) ? r.tenants[0] : r.tenants;
          return t?.id;
        })
        .filter(Boolean) as string[];

      await loadCycles(tenantIds);
    }

    run();
    return () => { cancelled = true; };
  }, [router, supabase, loadCycles]);

  async function startCycle(tenantId: string) {
    if (!supabase) return;
    setStartingCycle(tenantId);
    try {
      const { data: cycle, error: cycleErr } = await supabase
        .from("service_cycles")
        .upsert(
          { tenant_id: tenantId, month, status: "collecting" },
          { onConflict: "tenant_id,month" }
        )
        .select("id, tenant_id, month, status")
        .single();

      if (cycleErr || !cycle) {
        setError(cycleErr?.message ?? "Failed to create cycle");
        return;
      }

      const defaultTasks = [
        "Collect statements",
        "Review intake events",
        "Categorize transactions",
        "Reconcile to bank",
        "Run BVA and variances",
        "Generate report pack",
        "Send insight summary",
        "Schedule review call",
      ];

      await supabase.from("cycle_tasks").insert(
        defaultTasks.map((taskType) => ({
          service_cycle_id: cycle.id,
          tenant_id: tenantId,
          task_type: taskType,
          status: "todo",
        }))
      );

      setCycles((prev) => ({ ...prev, [tenantId]: cycle }));
    } finally {
      setStartingCycle(null);
    }
  }

  async function onSignOut() {
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tenants</h1>
          <p className="mt-1 text-sm text-zinc-500">Clients assigned to you.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/new-tenant">
            <Button variant="primary">New tenant</Button>
          </Link>
          <Button onClick={onSignOut} variant="secondary">Sign out</Button>
        </div>
      </div>

      {error && (
        <Card className="mt-6">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      <Card className="mt-6 p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-[#f0f0f0]">Assigned clients</h2>
          <input
            type="search"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-[#2a2a2a] bg-[#141414] text-[#f0f0f0] placeholder:text-[#505050] px-3 py-1.5 text-sm outline-none focus:border-[#0057ff] w-48 transition-colors"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[#606060] bg-[#0d0d0d]">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Tier</th>
                <th className="px-5 py-3 font-medium">Niche</th>
                <th className="px-5 py-3 font-medium">Your role</th>
                <th className="px-5 py-3 font-medium">Cycle</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && (
                <tr>
                  <td className="px-5 py-4 text-zinc-400" colSpan={5}>Loading...</td>
                </tr>
              )}
              {rows?.filter((row) => {
                const t = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
                if (!t) return false;
                return !search || t.name.toLowerCase().includes(search.toLowerCase());
              }).map((row, idx) => {
                const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
                if (!tenant) return null;
                return (
                  <tr key={`${tenant.id}-${idx}`} className="border-t border-[#1a1a1a] hover:bg-[#161616] transition-colors">
                    <td className="px-5 py-3">
                      <Link className="font-medium hover:underline text-zinc-900" href={`/app/tenants/${tenant.id}`}>
                        {tenant.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${TIER_COLORS[tenant.package_tier] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {TIER_LABEL[tenant.package_tier] ?? tenant.package_tier}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-600">{tenant.niche ?? "—"}</td>
                    <td className="px-5 py-3 text-zinc-600 capitalize">{row.role.replace("_", " ")}</td>
                    <td className="px-5 py-3">
                      {cycles[tenant.id] ? (
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${CYCLE_STATUS_COLORS[cycles[tenant.id].status] ?? "bg-zinc-100 text-zinc-600"}`}>
                          {cycles[tenant.id].status}
                        </span>
                      ) : (
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          disabled={startingCycle === tenant.id}
                          onClick={() => startCycle(tenant.id)}
                        >
                          {startingCycle === tenant.id ? "Starting..." : "Start cycle"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows && rows.filter((row) => { const t = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants; return t && (!search || t.name.toLowerCase().includes(search.toLowerCase())); }).length === 0 && (
                <tr>
                  <td className="px-5 py-4 text-zinc-500" colSpan={5}>
                    {search ? `No clients matching "${search}".` : <>No tenants assigned. Add a row to <code>tenant_users</code> in Supabase.</>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
