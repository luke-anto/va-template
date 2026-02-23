import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const payloadSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) // first day of month recommended
});

function requireAdminToken(request: Request) {
  const expected = process.env.DASHBOARD_ADMIN_TOKEN;
  if (!expected) throw new Error("Missing DASHBOARD_ADMIN_TOKEN.");
  const got = request.headers.get("x-admin-token");
  return !!got && got === expected;
}

export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    if (!requireAdminToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { tenantId } = await params;

    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const supabase = createAdminSupabaseClient();

    const { data: cycle, error: cycleErr } = await supabase
      .from("service_cycles")
      .upsert({ tenant_id: tenantId, month: parsed.data.month, status: "collecting" }, { onConflict: "tenant_id,month" })
      .select("id, tenant_id, month, status")
      .single();

    if (cycleErr || !cycle) return NextResponse.json({ error: cycleErr?.message ?? "Failed to create cycle" }, { status: 500 });

    const defaultTasks = [
      "Collect statements",
      "Review intake events",
      "Categorize transactions",
      "Reconcile to bank",
      "Run BVA and variances",
      "Generate report pack",
      "Send insight summary",
      "Schedule review call"
    ];

    const { error: tasksErr } = await supabase.from("cycle_tasks").insert(
      defaultTasks.map((taskType) => ({
        service_cycle_id: cycle.id,
        tenant_id: tenantId,
        task_type: taskType,
        status: "todo"
      }))
    );

    if (tasksErr) return NextResponse.json({ error: tasksErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, cycle });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

