"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format, startOfMonth } from "date-fns";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tenant = {
  id: string;
  name: string;
  package_tier: string;
  niche: string | null;
  timezone: string | null;
  currency: string | null;
};

type CycleTask = {
  id: string;
  task_type: string;
  assignee: string | null;
  status: string;
  due_date: string | null;
};

type Deliverable = {
  id: string;
  service_cycle_id: string;
  type: string;
  url: string | null;
  created_at: string;
};

type ServiceCycle = {
  id: string;
  month: string;
  status: string;
  tasks?: CycleTask[];
  deliverables?: Deliverable[];
};

type IntakeEvent = {
  id: string;
  source: string;
  date: string | null;
  amount: number | null;
  description: string | null;
  status: string;
  created_at: string;
};

type Invoice = {
  id: string;
  invoice_id: string | null;
  entity_id: string | null;
  date: string | null;
  due_date: string | null;
  amount: number | null;
  status: string | null;
};

type MissingDataAlert = {
  id: string;
  week_start: string;
  missing_receipts_count: number;
  status: string;
};

type KPIs = {
  openIntake: number;
  cycleStatus: string | null;
  tasksRemaining: number;
  openInvoices: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CYCLE_STATUS_COLORS: Record<string, string> = {
  collecting:  "bg-yellow-100 text-yellow-800",
  processing:  "bg-blue-100 text-blue-800",
  reconciling: "bg-purple-100 text-purple-800",
  reporting:   "bg-orange-100 text-orange-800",
  delivered:   "bg-green-100 text-green-800",
  paused:      "bg-zinc-100 text-zinc-600",
};

const INTAKE_STATUS_COLORS: Record<string, string> = {
  new:         "bg-red-100 text-red-700",
  categorized: "bg-yellow-100 text-yellow-700",
  posted:      "bg-green-100 text-green-700",
};

const TASK_STATUS_NEXT: Record<string, string> = {
  todo:        "in_progress",
  in_progress: "done",
  done:        "todo",
};

const CYCLE_STATUS_ORDER = ["collecting", "processing", "reconciling", "reporting", "delivered"];
const DELIVERABLE_TYPES = ["Report Pack", "Insight Summary", "Reconciliation", "BVA Report", "Invoice Summary", "Other"];

// ─── Shared components ────────────────────────────────────────────────────────

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${colorClass}`}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-bold text-zinc-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-400">{sub}</div>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 animate-pulse">
      <div className="h-4 w-1/3 bg-zinc-100 rounded" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full bg-zinc-100 rounded" />
        <div className="h-3 w-3/4 bg-zinc-100 rounded" />
      </div>
    </div>
  );
}

// ─── Alerts Banner ────────────────────────────────────────────────────────────

function AlertsBanner({ alerts, onDismiss }: { alerts: MissingDataAlert[]; onDismiss: (id: string) => void }) {
  const open = alerts.filter((a) => a.status === "open");
  if (open.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
      <div className="flex items-start gap-3">
        <svg className="mt-0.5 w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800">Missing intake data</p>
          <ul className="mt-1 space-y-1">
            {open.map((alert) => (
              <li key={alert.id} className="flex items-center justify-between gap-4">
                <span className="text-xs text-amber-700">
                  Week of {format(new Date(alert.week_start), "MMM d")} — {alert.missing_receipts_count} missing receipt{alert.missing_receipts_count !== 1 ? "s" : ""}
                </span>
                <button onClick={() => onDismiss(alert.id)} className="text-xs text-amber-600 hover:underline whitespace-nowrap">Dismiss</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Deliverables sub-section ─────────────────────────────────────────────────

function DeliverablesSection({ cycleId, tenantId, deliverables, onAdded }: {
  cycleId: string; tenantId: string; deliverables: Deliverable[]; onAdded: (d: Deliverable) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState(DELIVERABLE_TYPES[0]);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { setSaving(false); return; }
    const { data, error } = await supabase
      .from("deliverables")
      .insert({ service_cycle_id: cycleId, tenant_id: tenantId, type, url: url.trim() || null })
      .select("id,service_cycle_id,type,url,created_at")
      .single();
    setSaving(false);
    if (!error && data) { onAdded(data as Deliverable); setUrl(""); setType(DELIVERABLE_TYPES[0]); setAdding(false); }
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Deliverables</span>
        {!adding && <button onClick={() => setAdding(true)} className="text-xs text-zinc-500 hover:text-zinc-800">+ Add</button>}
      </div>
      {deliverables.length === 0 && !adding && <p className="text-xs text-zinc-400">No deliverables attached.</p>}
      <ul className="space-y-1">
        {deliverables.map((d) => (
          <li key={d.id} className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500 w-32 flex-shrink-0">{d.type}</span>
            {d.url ? (
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-xs">{d.url}</a>
            ) : <span className="text-zinc-400">No URL</span>}
          </li>
        ))}
      </ul>
      {adding && (
        <div className="mt-2 flex items-end gap-2">
          <div>
            <div className="text-xs text-zinc-500 mb-1">Type</div>
            <select className="rounded border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-zinc-400" value={type} onChange={(e) => setType(e.target.value)}>
              {DELIVERABLE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <div className="text-xs text-zinc-500 mb-1">URL (optional)</div>
            <input className="w-full rounded border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-zinc-400" placeholder="https://drive.google.com/..." value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <button onClick={save} disabled={saving} className="rounded bg-zinc-900 px-3 py-1 text-xs text-white disabled:bg-zinc-400 hover:bg-zinc-700">{saving ? "Saving…" : "Save"}</button>
          <button onClick={() => setAdding(false)} className="text-xs text-zinc-500 hover:text-zinc-800">Cancel</button>
        </div>
      )}
    </div>
  );
}

// ─── Cycles Section ───────────────────────────────────────────────────────────

function CyclesSection({ tenantId, cycles, onCycleStarted, onTaskToggled, onCycleAdvanced, onDeliverableAdded }: {
  tenantId: string;
  cycles: ServiceCycle[];
  onCycleStarted: () => void;
  onTaskToggled: (cycleId: string, taskId: string, newStatus: string) => void;
  onCycleAdvanced: (cycleId: string, newStatus: string) => void;
  onDeliverableAdded: (cycleId: string, d: Deliverable) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(cycles[0]?.id ?? null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [confirmAdvance, setConfirmAdvance] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState<string | null>(null);
  // CYCLE-03: track pre-pause status for resume
  const [prePauseStatus, setPrePauseStatus] = useState<Record<string, string>>({});

  const thisMonth = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const hasThisMonth = cycles.some((c) => c.month.startsWith(thisMonth.slice(0, 7)));

  async function startCycle() {
    setStarting(true);
    setStartError(null);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { setStartError("No Supabase client."); setStarting(false); return; }
    const { data: cycle, error: cycleErr } = await supabase
      .from("service_cycles")
      .upsert({ tenant_id: tenantId, month: thisMonth, status: "collecting" }, { onConflict: "tenant_id,month" })
      .select("id").single();
    if (cycleErr || !cycle) { setStartError(cycleErr?.message ?? "Failed to create cycle."); setStarting(false); return; }
    const defaultTasks = ["Collect statements","Review intake events","Categorize transactions","Reconcile to bank","Run BVA and variances","Generate report pack","Send insight summary","Schedule review call"];
    await supabase.from("cycle_tasks").insert(defaultTasks.map((t) => ({ service_cycle_id: cycle.id, tenant_id: tenantId, task_type: t, status: "todo" })));
    setStarting(false);
    onCycleStarted();
  }

  async function advanceCycle(cycle: ServiceCycle) {
    const currentIdx = CYCLE_STATUS_ORDER.indexOf(cycle.status);
    if (currentIdx === -1 || currentIdx >= CYCLE_STATUS_ORDER.length - 1) return;
    const openTasks = (cycle.tasks ?? []).filter((t) => t.status !== "done");
    if (openTasks.length > 0 && confirmAdvance !== cycle.id) { setConfirmAdvance(cycle.id); return; }
    setConfirmAdvance(null);
    setAdvancing(cycle.id);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { setAdvancing(null); return; }
    const nextStatus = CYCLE_STATUS_ORDER[currentIdx + 1];
    await supabase.from("service_cycles").update({ status: nextStatus }).eq("id", cycle.id);
    setAdvancing(null);
    onCycleAdvanced(cycle.id, nextStatus);
  }

  async function pauseCycle(cycle: ServiceCycle) {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    setPrePauseStatus((prev) => ({ ...prev, [cycle.id]: cycle.status }));
    await supabase.from("service_cycles").update({ status: "paused" }).eq("id", cycle.id);
    onCycleAdvanced(cycle.id, "paused");
  }

  async function resumeCycle(cycle: ServiceCycle) {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    const restoreStatus = prePauseStatus[cycle.id] ?? "collecting";
    await supabase.from("service_cycles").update({ status: restoreStatus }).eq("id", cycle.id);
    setPrePauseStatus((prev) => { const n = { ...prev }; delete n[cycle.id]; return n; });
    onCycleAdvanced(cycle.id, restoreStatus);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-zinc-900">Service Cycles</h2>
        {!hasThisMonth && (
          <Button onClick={startCycle} variant="primary" disabled={starting}>
            {starting ? "Starting…" : `Start ${format(new Date(), "MMMM")} cycle`}
          </Button>
        )}
      </div>

      {startError && <p className="mb-3 text-sm text-red-600">{startError}</p>}

      {cycles.length === 0 && (
        <Card><p className="text-sm text-zinc-500">No cycles yet. Start this month&apos;s cycle above.</p></Card>
      )}

      <div className="space-y-3">
        {cycles.map((cycle) => {
          const isOpen = expanded === cycle.id;
          const tasks = cycle.tasks ?? [];
          const done = tasks.filter((t) => t.status === "done").length;
          const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
          const statusColor = CYCLE_STATUS_COLORS[cycle.status] ?? "bg-zinc-100 text-zinc-600";
          const canAdvance = cycle.status !== "paused" && CYCLE_STATUS_ORDER.indexOf(cycle.status) < CYCLE_STATUS_ORDER.length - 1;
          const canPause = cycle.status !== "paused" && cycle.status !== "delivered";
          const isAdvancing = advancing === cycle.id;
          const isConfirming = confirmAdvance === cycle.id;

          return (
            <Card key={cycle.id} className="p-0 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <button className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity" onClick={() => setExpanded(isOpen ? null : cycle.id)}>
                  <span className="font-medium text-sm text-zinc-900">{format(new Date(cycle.month), "MMMM yyyy")}</span>
                  <Badge label={cycle.status} colorClass={statusColor} />
                  {tasks.length > 0 && <span className="text-xs text-zinc-500">{done}/{tasks.length}</span>}
                </button>

                <div className="flex items-center gap-2 ml-3">
                  {/* Pause / Resume */}
                  {canPause && (
                    <button onClick={() => pauseCycle(cycle)} className="text-xs text-zinc-400 hover:text-zinc-700 border border-zinc-200 rounded px-2 py-1 transition-colors hover:border-zinc-400">
                      Pause
                    </button>
                  )}
                  {cycle.status === "paused" && (
                    <button onClick={() => resumeCycle(cycle)} className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 transition-colors hover:border-blue-400">
                      Resume
                    </button>
                  )}

                  {/* Advance */}
                  {canAdvance && !isConfirming && (
                    <button onClick={() => advanceCycle(cycle)} disabled={isAdvancing} className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded px-2 py-1 disabled:opacity-50 transition-colors hover:border-zinc-400">
                      {isAdvancing ? "Advancing…" : "Advance →"}
                    </button>
                  )}
                  {isConfirming && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-amber-700">{tasks.filter((t) => t.status !== "done").length} open.</span>
                      <button onClick={() => advanceCycle(cycle)} className="text-white bg-amber-500 hover:bg-amber-600 rounded px-2 py-1">Confirm</button>
                      <button onClick={() => setConfirmAdvance(null)} className="text-zinc-500 hover:text-zinc-800">Cancel</button>
                    </div>
                  )}

                  <svg className={`w-4 h-4 text-zinc-400 transition-transform cursor-pointer ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} onClick={() => setExpanded(isOpen ? null : cycle.id)}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {tasks.length > 0 && (
                <div className="h-1 bg-zinc-100">
                  <div className="h-1 bg-green-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}

              {isOpen && (
                <div className="px-5 py-3 border-t border-zinc-100">
                  {tasks.length === 0 && <p className="text-sm text-zinc-400 py-2">No tasks for this cycle.</p>}
                  <ul className="space-y-1">
                    {tasks.map((task) => (
                      <li key={task.id} className="flex items-center gap-3 py-1.5">
                        <button
                          onClick={() => onTaskToggled(cycle.id, task.id, TASK_STATUS_NEXT[task.status] ?? "todo")}
                          className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${task.status === "done" ? "bg-green-500 border-green-500" : task.status === "in_progress" ? "bg-yellow-400 border-yellow-400" : "border-zinc-300 hover:border-zinc-400"}`}
                          title={`${task.status} — click to advance`}
                        >
                          {task.status === "done" && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          {task.status === "in_progress" && <div className="w-2 h-2 bg-white rounded-sm" />}
                        </button>
                        <span className={`text-sm ${task.status === "done" ? "line-through text-zinc-400" : "text-zinc-700"}`}>{task.task_type}</span>
                        {task.assignee && <span className="ml-auto text-xs text-zinc-400">{task.assignee}</span>}
                      </li>
                    ))}
                  </ul>
                  <DeliverablesSection cycleId={cycle.id} tenantId={tenantId} deliverables={cycle.deliverables ?? []} onAdded={(d) => onDeliverableAdded(cycle.id, d)} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Invoices Section ─────────────────────────────────────────────────────────

function InvoicesSection({ invoices, onMarkPaid }: { invoices: Invoice[]; onMarkPaid: (id: string) => void }) {
  const open = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled");
  const closed = invoices.filter((i) => i.status === "paid" || i.status === "cancelled");
  const [showClosed, setShowClosed] = useState(false);

  const display = showClosed ? invoices : open;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-zinc-900">Invoices</h2>
        {closed.length > 0 && (
          <button onClick={() => setShowClosed((v) => !v)} className="text-xs text-zinc-500 hover:text-zinc-800">
            {showClosed ? "Hide paid/cancelled" : `Show all (${invoices.length})`}
          </button>
        )}
      </div>

      <Card className="p-0 overflow-hidden">
        {display.length === 0 && (
          <p className="px-5 py-6 text-sm text-zinc-500">{open.length === 0 ? "No open invoices." : "No invoices yet."}</p>
        )}
        {display.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500 bg-zinc-50">
              <tr>
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Due</th>
                <th className="px-5 py-3 font-medium text-right">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {display.map((inv) => {
                const isPaid = inv.status === "paid";
                const isCancelled = inv.status === "cancelled";
                const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && !isPaid && !isCancelled;
                return (
                  <tr key={inv.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-5 py-3 font-mono text-xs text-zinc-700">{inv.invoice_id ?? "—"}</td>
                    <td className="px-5 py-3 text-zinc-600 whitespace-nowrap">{inv.date ? format(new Date(inv.date), "MMM d") : "—"}</td>
                    <td className={`px-5 py-3 whitespace-nowrap text-xs ${isOverdue ? "text-red-600 font-medium" : "text-zinc-600"}`}>
                      {inv.due_date ? format(new Date(inv.due_date), "MMM d") : "—"}
                      {isOverdue && " ⚠"}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-zinc-900">{inv.amount != null ? `$${Number(inv.amount).toFixed(2)}` : "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${isPaid ? "bg-green-100 text-green-700" : isCancelled ? "bg-zinc-100 text-zinc-500" : isOverdue ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {inv.status ?? "unknown"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {!isPaid && !isCancelled && (
                        <button onClick={() => onMarkPaid(inv.id)} className="text-xs text-green-600 hover:underline">Mark paid</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ─── Intake Section ───────────────────────────────────────────────────────────

function IntakeSection({ tenantId, events, onStatusChange, onTransactionCreated }: {
  tenantId: string;
  events: IntakeEvent[];
  onStatusChange: (id: string, newStatus: string) => void;
  onTransactionCreated: (eventId: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "new" | "categorized" | "posted">("all");
  const [txForm, setTxForm] = useState<string | null>(null);
  const [txDate, setTxDate] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [txCategory, setTxCategory] = useState("");
  const [txSaving, setTxSaving] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const filtered = filter === "all" ? events : events.filter((e) => e.status === filter);

  function exportCSV() {
    const rows = [["Date", "Description", "Amount", "Status", "Source"]];
    filtered.forEach((e) => {
      rows.push([
        e.date ?? "",
        (e.description ?? "").replace(/,/g, ";"),
        e.amount != null ? String(e.amount) : "",
        e.status,
        e.source,
      ]);
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intake-events-${tenantId}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openTxForm(event: IntakeEvent) {
    setTxForm(event.id);
    setTxDate(event.date ?? "");
    setTxAmount(event.amount != null ? String(event.amount) : "");
    setTxDesc(event.description ?? "");
    setTxCategory("");
    setTxError(null);
  }

  async function submitTransaction(eventId: string) {
    if (!txCategory.trim()) { setTxError("Category ID is required."); return; }
    if (!txDate) { setTxError("Date is required."); return; }
    setTxSaving(true);
    setTxError(null);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) { setTxSaving(false); return; }
    const { error: txErr } = await supabase.from("transactions").insert({
      tenant_id: tenantId,
      date: txDate,
      description: txDesc.trim() || "Intake event",
      category_id: txCategory.trim(),
      amount: parseFloat(txAmount) || 0,
      status: "Received",
    });
    if (txErr) { setTxError(txErr.message); setTxSaving(false); return; }
    await supabase.from("intake_events").update({ status: "posted" }).eq("id", eventId);
    setTxSaving(false);
    setTxForm(null);
    onTransactionCreated(eventId);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-zinc-900">Intake Events</h2>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button onClick={exportCSV} className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded px-2 py-1 transition-colors hover:border-zinc-400">
              Export CSV
            </button>
          )}
          <div className="flex gap-1">
            {(["all", "new", "categorized", "posted"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${filter === f ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 && (
          <p className="px-5 py-6 text-sm text-zinc-500">{filter === "all" ? "No intake events yet." : `No ${filter} events.`}</p>
        )}
        {filtered.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500 bg-zinc-50">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium text-right">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((event) => (
                <>
                  <tr key={event.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-5 py-3 text-zinc-600 whitespace-nowrap">{event.date ? format(new Date(event.date), "MMM d") : "—"}</td>
                    <td className="px-5 py-3 text-zinc-700 max-w-xs truncate">{event.description ?? <span className="text-zinc-400">No description</span>}</td>
                    <td className="px-5 py-3 text-right font-mono text-zinc-900">{event.amount != null ? `$${Number(event.amount).toFixed(2)}` : "—"}</td>
                    <td className="px-5 py-3">
                      <Badge label={event.status} colorClass={INTAKE_STATUS_COLORS[event.status] ?? "bg-zinc-100 text-zinc-600"} />
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {event.status === "new" && <button onClick={() => onStatusChange(event.id, "categorized")} className="text-xs text-blue-600 hover:underline">Mark categorized</button>}
                      {event.status === "categorized" && txForm !== event.id && <button onClick={() => openTxForm(event)} className="text-xs text-green-600 hover:underline">Create transaction</button>}
                      {event.status === "categorized" && txForm === event.id && <button onClick={() => setTxForm(null)} className="text-xs text-zinc-400 hover:underline">Cancel</button>}
                      {event.status === "posted" && <span className="text-xs text-zinc-400">Posted</span>}
                    </td>
                  </tr>
                  {txForm === event.id && (
                    <tr key={`${event.id}-tx`} className="bg-zinc-50 border-t border-zinc-100">
                      <td colSpan={5} className="px-5 py-4">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <div className="text-xs text-zinc-500 mb-1">Date</div>
                            <input type="date" className="rounded border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-zinc-400" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
                          </div>
                          <div>
                            <div className="text-xs text-zinc-500 mb-1">Amount</div>
                            <input type="number" step="0.01" className="w-28 rounded border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-zinc-400" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} />
                          </div>
                          <div className="flex-1 min-w-32">
                            <div className="text-xs text-zinc-500 mb-1">Description</div>
                            <input className="w-full rounded border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-zinc-400" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} />
                          </div>
                          <div>
                            <div className="text-xs text-zinc-500 mb-1">Category ID <span className="text-red-500">*</span></div>
                            <input className="w-24 rounded border border-zinc-200 px-2 py-1 text-xs outline-none focus:border-zinc-400" placeholder="e.g. 4100" value={txCategory} onChange={(e) => setTxCategory(e.target.value)} />
                          </div>
                          <button onClick={() => submitTransaction(event.id)} disabled={txSaving} className="rounded bg-zinc-900 px-3 py-1.5 text-xs text-white hover:bg-zinc-700 disabled:bg-zinc-400">{txSaving ? "Saving…" : "Post transaction"}</button>
                        </div>
                        {txError && <p className="mt-2 text-xs text-red-600">{txError}</p>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [cycles, setCycles] = useState<ServiceCycle[]>([]);
  const [intake, setIntake] = useState<IntakeEvent[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [alerts, setAlerts] = useState<MissingDataAlert[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setError("Missing Supabase env vars."); setLoading(false); return; }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/login"); return; }

    const [tenantRes, cyclesRes, tasksRes, deliverablesRes, intakeRes, invoicesRes, alertsRes] = await Promise.all([
      supabase.from("tenants").select("id,name,package_tier,niche,timezone,currency").eq("id", tenantId).single(),
      supabase.from("service_cycles").select("id,month,status").eq("tenant_id", tenantId).order("month", { ascending: false }),
      supabase.from("cycle_tasks").select("id,service_cycle_id,task_type,assignee,status,due_date").eq("tenant_id", tenantId),
      supabase.from("deliverables").select("id,service_cycle_id,type,url,created_at").eq("tenant_id", tenantId),
      supabase.from("intake_events").select("id,source,date,amount,description,status,created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
      supabase.from("invoices").select("id,invoice_id,entity_id,date,due_date,amount,status").eq("tenant_id", tenantId).order("due_date", { ascending: true }),
      supabase.from("missing_data_alerts").select("id,week_start,missing_receipts_count,status").eq("tenant_id", tenantId).eq("status", "open").order("week_start", { ascending: false }),
    ]);

    if (tenantRes.error) { setError(tenantRes.error.message); setLoading(false); return; }

    const tasksByCycle = (tasksRes.data ?? []).reduce<Record<string, CycleTask[]>>((acc, t) => {
      const cid = (t as { service_cycle_id: string } & CycleTask).service_cycle_id;
      if (!acc[cid]) acc[cid] = [];
      acc[cid].push(t as CycleTask);
      return acc;
    }, {});

    const deliverablesByCycle = (deliverablesRes.data ?? []).reduce<Record<string, Deliverable[]>>((acc, d) => {
      const cid = (d as Deliverable).service_cycle_id;
      if (!acc[cid]) acc[cid] = [];
      acc[cid].push(d as Deliverable);
      return acc;
    }, {});

    const enrichedCycles: ServiceCycle[] = (cyclesRes.data ?? []).map((c) => ({
      ...c,
      tasks: tasksByCycle[c.id] ?? [],
      deliverables: deliverablesByCycle[c.id] ?? [],
    }));

    const thisMonthStr = format(startOfMonth(new Date()), "yyyy-MM");
    const thisMonthCycle = enrichedCycles.find((c) => c.month.startsWith(thisMonthStr));
    const allInvoices = (invoicesRes.data ?? []) as Invoice[];
    const openIntake = (intakeRes.data ?? []).filter((e) => e.status === "new").length;
    const tasksRemaining = (thisMonthCycle?.tasks ?? []).filter((t) => t.status !== "done").length;
    const openInvoices = allInvoices.filter((i) => i.status !== "paid" && i.status !== "cancelled").length;

    setTenant(tenantRes.data as Tenant);
    setCycles(enrichedCycles);
    setIntake((intakeRes.data ?? []) as IntakeEvent[]);
    setInvoices(allInvoices);
    setAlerts((alertsRes.data ?? []) as MissingDataAlert[]);
    setKpis({ openIntake, cycleStatus: thisMonthCycle?.status ?? null, tasksRemaining, openInvoices });
    setLoading(false);
  }, [supabase, tenantId, router]);

  useEffect(() => { load(); }, [load]);

  async function handleAlertDismiss(id: string) {
    if (!supabase) return;
    await supabase.from("missing_data_alerts").update({ status: "closed" }).eq("id", id);
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: "closed" } : a));
  }

  async function handleTaskToggle(cycleId: string, taskId: string, newStatus: string) {
    if (!supabase) return;
    await supabase.from("cycle_tasks").update({ status: newStatus }).eq("id", taskId);
    setCycles((prev) => prev.map((c) => c.id === cycleId
      ? { ...c, tasks: (c.tasks ?? []).map((t) => t.id === taskId ? { ...t, status: newStatus } : t) }
      : c
    ));
    setKpis((prev) => {
      if (!prev) return prev;
      const thisMonthStr = format(startOfMonth(new Date()), "yyyy-MM");
      const cycle = cycles.find((c) => c.id === cycleId);
      if (!cycle?.month.startsWith(thisMonthStr)) return prev;
      const delta = newStatus === "done" ? -1 : newStatus === "todo" ? 1 : 0;
      return { ...prev, tasksRemaining: Math.max(0, prev.tasksRemaining + delta) };
    });
  }

  function handleCycleAdvanced(cycleId: string, newStatus: string) {
    setCycles((prev) => prev.map((c) => c.id === cycleId ? { ...c, status: newStatus } : c));
    setKpis((prev) => {
      if (!prev) return prev;
      const thisMonthStr = format(startOfMonth(new Date()), "yyyy-MM");
      const cycle = cycles.find((c) => c.id === cycleId);
      if (!cycle?.month.startsWith(thisMonthStr)) return prev;
      return { ...prev, cycleStatus: newStatus };
    });
  }

  function handleDeliverableAdded(cycleId: string, d: Deliverable) {
    setCycles((prev) => prev.map((c) => c.id === cycleId ? { ...c, deliverables: [...(c.deliverables ?? []), d] } : c));
  }

  async function handleIntakeStatusChange(id: string, newStatus: string) {
    if (!supabase) return;
    await supabase.from("intake_events").update({ status: newStatus }).eq("id", id);
    setIntake((prev) => prev.map((e) => e.id === id ? { ...e, status: newStatus } : e));
    if (newStatus !== "new") setKpis((prev) => prev ? { ...prev, openIntake: Math.max(0, prev.openIntake - 1) } : prev);
  }

  function handleTransactionCreated(eventId: string) {
    setIntake((prev) => prev.map((e) => e.id === eventId ? { ...e, status: "posted" } : e));
    setKpis((prev) => prev ? { ...prev, openIntake: Math.max(0, prev.openIntake - 1) } : prev);
  }

  async function handleInvoiceMarkPaid(id: string) {
    if (!supabase) return;
    await supabase.from("invoices").update({ status: "paid" }).eq("id", id);
    setInvoices((prev) => prev.map((i) => i.id === id ? { ...i, status: "paid" } : i));
    setKpis((prev) => prev ? { ...prev, openInvoices: Math.max(0, prev.openInvoices - 1) } : prev);
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8 space-y-4">
        <div className="h-6 w-48 bg-zinc-100 rounded animate-pulse" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}</div>
        <SkeletonCard /><SkeletonCard />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      <div className="text-sm text-zinc-500">
        <Link href="/app" className="hover:underline">Tenants</Link>{" "}
        / <span className="text-zinc-900 font-medium">{tenant?.name ?? tenantId}</span>
      </div>

      {error && <Card><p className="text-sm text-red-700">{error}</p></Card>}

      <AlertsBanner alerts={alerts} onDismiss={handleAlertDismiss} />

      {tenant && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{tenant.name}</h1>
            <p className="mt-0.5 text-sm text-zinc-500 capitalize">
              {tenant.package_tier.replace(/_/g, " ")} package
              {tenant.niche ? ` · ${tenant.niche}` : ""}
              {tenant.currency ? ` · ${tenant.currency}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/app/tenants/${tenantId}/analytics`} className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-3 py-1.5 transition-colors hover:border-zinc-400">
              Analytics
            </Link>
            <Link href={`/app/tenants/${tenantId}/settings`} className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-3 py-1.5 transition-colors hover:border-zinc-400">
              Settings
            </Link>
          </div>
        </div>
      )}

      {kpis && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Open intake" value={kpis.openIntake} sub={kpis.openIntake === 0 ? "All clear" : "Need categorizing"} />
          <KpiCard label="This month" value={kpis.cycleStatus ? kpis.cycleStatus.replace(/_/g, " ") : "No cycle"} sub={kpis.cycleStatus ? "cycle active" : "start below"} />
          <KpiCard label="Tasks left" value={kpis.tasksRemaining} sub="this month's cycle" />
          <KpiCard label="Open invoices" value={kpis.openInvoices} sub={kpis.openInvoices === 0 ? "All settled" : "outstanding"} />
        </div>
      )}

      <CyclesSection
        tenantId={tenantId}
        cycles={cycles}
        onCycleStarted={load}
        onTaskToggled={handleTaskToggle}
        onCycleAdvanced={handleCycleAdvanced}
        onDeliverableAdded={handleDeliverableAdded}
      />

      <InvoicesSection invoices={invoices} onMarkPaid={handleInvoiceMarkPaid} />

      <IntakeSection
        tenantId={tenantId}
        events={intake}
        onStatusChange={handleIntakeStatusChange}
        onTransactionCreated={handleTransactionCreated}
      />
    </main>
  );
}
