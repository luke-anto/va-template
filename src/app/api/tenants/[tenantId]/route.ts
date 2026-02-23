import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  name:         z.string().min(1).max(200).optional(),
  package_tier: z.enum(["foundation", "growth", "cfo_lite"]).optional(),
  niche:        z.string().max(200).nullable().optional(),
  timezone:     z.string().max(100).nullable().optional(),
  currency:     z.string().max(10).nullable().optional(),
});

async function resolveUser(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data } = await userClient.auth.getUser();
  return data.user ?? null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const user = await resolveUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tenantId } = await params;

    // Verify user is a member of this tenant
    const admin = createAdminSupabaseClient();
    const { data: membership } = await admin
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .single();

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });

    const { data: tenant, error: updateErr } = await admin
      .from("tenants")
      .update(parsed.data)
      .eq("id", tenantId)
      .select("id,name,package_tier,niche,timezone,currency")
      .single();

    if (updateErr || !tenant) return NextResponse.json({ error: updateErr?.message ?? "Update failed" }, { status: 500 });

    return NextResponse.json({ ok: true, tenant });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
