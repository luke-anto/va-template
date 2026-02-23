import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const intakeSchema = z.object({
  tenant_id: z.string().uuid(),
  source: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.number().finite().optional(),
  description: z.string().optional(),
  attachment_url: z.string().url().optional(),
  raw_payload: z.unknown().optional()
});

function requireIntakeToken(request: Request) {
  const expected = process.env.INTAKE_SHARED_SECRET;
  if (!expected) throw new Error("Missing INTAKE_SHARED_SECRET.");
  const got = request.headers.get("x-intake-token");
  if (!got || got !== expected) {
    return false;
  }
  return true;
}

export async function POST(request: Request) {
  try {
    if (!requireIntakeToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = intakeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.from("intake_events").insert({
      tenant_id: parsed.data.tenant_id,
      source: parsed.data.source,
      date: parsed.data.date ?? null,
      amount: typeof parsed.data.amount === "number" ? parsed.data.amount : null,
      description: parsed.data.description ?? null,
      attachment_url: parsed.data.attachment_url ?? null,
      raw_payload: parsed.data.raw_payload ?? null,
      status: "new"
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

