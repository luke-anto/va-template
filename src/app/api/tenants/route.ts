import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const createTenantSchema = z.object({
  name: z.string().min(1).max(200),
  package_tier: z.enum(["foundation", "growth", "cfo_lite"]),
  niche: z.string().max(200).optional().default(""),
  timezone: z.string().max(100).optional().default(""),
  currency: z.string().max(10).optional().default(""),
});

export async function POST(request: Request) {
  try {
    // Verify user from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();
    const { name, package_tier, niche, timezone, currency } = parsed.data;

    // Create tenant
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({
        name,
        package_tier,
        niche: niche || null,
        timezone: timezone || null,
        currency: currency || null,
      })
      .select("id, name, package_tier, niche, timezone, currency")
      .single();

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: tenantErr?.message ?? "Failed to create tenant" }, { status: 500 });
    }

    // Assign current user as owner
    const { error: memberErr } = await admin
      .from("tenant_users")
      .insert({
        tenant_id: tenant.id,
        user_id: userData.user.id,
        role: "owner",
      });

    if (memberErr) {
      // Rollback tenant on failure
      await admin.from("tenants").delete().eq("id", tenant.id);
      return NextResponse.json({ error: memberErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, tenant });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
