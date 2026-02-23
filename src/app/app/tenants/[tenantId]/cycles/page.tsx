"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

type CycleTask = {
  id: string;
  task_type: string;
  status: string;
  assignee: string | null;
  due_date: string | null;
};

type Deliverable = {
  id: string;
  type: string;
  url: string | null;
  created_at: string;
};

type Cycle = {
  id: string;
  month: string;
  status: string;
  created_at: string;
  tasks: CycleTask[];
  deliverables: Deliverable[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  collecting:  "bg-yellow-100 text-yellow-800",
  processing:  "bg-blue-100 text-blue-800",
  reconciling: "bg-purple-100 text-purple-800",
  reporting:   "bg-orange-100 text-orange-800",
  delivered:   "bg-green-100 text-green-800",
  paused:      "bg-zinc-100 text-zinc-600",
};

const TASK_COLORS: Record<string, string> = {
  done:        "bg-green-100 text-green-800",
  in_progress: "bg-blue-100 text-blue-800",
  todo:        "bg-zinc-100 text-zinc-500",
};

function pct(done: number, total: number) {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CycleHistoryPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [tenantName, setTenantName] = useState<string>("");
  const [cycles, setCycles]         = useState<Cycle[]>([]);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setError("Missing Supabase env vars."); setLoading(false); return; }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/login"); return; }

    const [tenantRes, cyclesRes, tasksRes, delivRes] = await Promise.all([
      supabase.from("tenants").select("name").eq("id", tenantId).single(),
      supabase.from("service_cycles").select("id,month,status,created_at").eq("tenant_id", tenantId).order("month", { ascending: false }),
      supabase.from("cycle_tasks").select("id,service_cycle_id,task_type,status,assignee,due_date").eq("tenant_id", tenantId),
      supabase.from("deliverables").select("id,service_cycle_id,type,url,created_at").eq("tenant_id", tenantId),
    ]);

    if (tenantRes.error || !tenantRes.data) { setError("Tenant not found."); setLoading(false); return; }
    setTenantName(tenantRes.data.name);

    const taskMap: Record<string, CycleTask[]> = {};
    (tasksRes.data ?? []).forEach((t) => {
      if (!taskMap[t.service_cycle_id]) taskMap[t.service_cycle_id] = [];
      taskMap[t.service_cycle_id].push(t);
    });

    const delivMap: Record<string, Deliverable[]> = {};
    (delivRes.data ?? []).forEach((d) => {
      if (!delivMap[d.service_cycle_id]) delivMap[d.service_cycle_id] = [];
      delivMap[d.service_cycle_id].push(d);
    });

    const built: Cycle[] = (cyclesRes.data ?? []).map((c) => ({
      ...c,
      tasks:        taskMap[c.id] ?? [],
      deliverables: delivMap[c.id] ?? [],
    }));

    setCycles(built);
    setLoading(false);
  }, [supabase, tenantId, router]);

  useEffect(() => { load(); }, [load]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 space-y-3">
        <div className="h-5 w-48 bg-zinc-100 rounded animate-pulse" />
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-zinc-100 rounded-xl animate-pulse" />)}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-zinc-500">
        <Link href="/app" className="hover:underline">Tenants</Link>{" "}
        /{" "}
        <Link href={`/app/tenants/${tenantId}`} className="hover:underline">{tenantName || tenantId}</Link>{" "}
        / <span className="text-zinc-900 font-medium">Cycle history</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Cycle history</h1>
        <span className="text-sm text-zinc-400">{cycles.length} cycle{cycles.length !== 1 ? "s" : ""}</span>
      </div>

      {error && <Card><p className="text-sm text-red-700">{error}</p></Card>}

      {cycles.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500 text-center py-6">No cycles started yet.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {cycles.map((cycle) => {
            const open   = expanded.has(cycle.id);
            const done   = cycle.tasks.filter((t) => t.status === "done").length;
            const total  = cycle.tasks.length;
            const completion = pct(done, total);
            const monthLabel = (() => {
              try { return format(new Date(cycle.month + "T12:00:00"), "MMMM yyyy"); }
              catch { return cycle.month; }
            })();

            return (
              <Card key={cycle.id} className="p-0 overflow-hidden">
                {/* Header row */}
                <button
                  onClick={() => toggle(cycle.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-medium text-zinc-900">{monthLabel}</span>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[cycle.status] ?? "bg-zinc-100 text-zinc-600"}`}>
                        {cycle.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      {/* Progress bar */}
                      <div className="h-1.5 w-32 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${cycle.status === "delivered" ? "bg-green-500" : "bg-blue-500"}`}
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400">{done}/{total} tasks · {completion}%</span>
                      {cycle.deliverables.length > 0 && (
                        <span className="text-xs text-zinc-400">{cycle.deliverables.length} deliverable{cycle.deliverables.length !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-zinc-400 text-sm shrink-0">{open ? "▲" : "▼"}</span>
                </button>

                {/* Expanded detail */}
                {open && (
                  <div className="border-t border-zinc-100 bg-zinc-50">
                    {/* Tasks */}
                    {cycle.tasks.length > 0 && (
                      <div className="px-5 py-4">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Tasks</p>
                        <div className="space-y-2">
                          {cycle.tasks.map((t) => (
                            <div key={t.id} className="flex items-center gap-3">
                              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TASK_COLORS[t.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                                {t.status.replace(/_/g, " ")}
                              </span>
                              <span className={`text-sm flex-1 ${t.status === "done" ? "line-through text-zinc-400" : "text-zinc-700"}`}>
                                {t.task_type.replace(/_/g, " ")}
                              </span>
                              {t.assignee && <span className="text-xs text-zinc-400">{t.assignee}</span>}
                              {t.due_date && (
                                <span className="text-xs text-zinc-400">
                                  due {(() => { try { return format(new Date(t.due_date), "MMM d"); } catch { return t.due_date; } })()}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Deliverables */}
                    {cycle.deliverables.length > 0 && (
                      <div className={`px-5 py-4 ${cycle.tasks.length > 0 ? "border-t border-zinc-100" : ""}`}>
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Deliverables</p>
                        <div className="space-y-2">
                          {cycle.deliverables.map((d) => (
                            <div key={d.id} className="flex items-center gap-3">
                              <span className="text-sm text-zinc-700 flex-1 capitalize">{d.type.replace(/_/g, " ")}</span>
                              {d.url ? (
                                <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                  Open ↗
                                </a>
                              ) : (
                                <span className="text-xs text-zinc-400">No link</span>
                              )}
                              <span className="text-xs text-zinc-400">
                                {(() => { try { return format(new Date(d.created_at), "MMM d"); } catch { return ""; } })()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {cycle.tasks.length === 0 && cycle.deliverables.length === 0 && (
                      <div className="px-5 py-4 text-sm text-zinc-400">No tasks or deliverables recorded.</div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
