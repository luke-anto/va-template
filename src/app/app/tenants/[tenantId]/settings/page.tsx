"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

const TIERS = [
  { value: "foundation", label: "Foundation" },
  { value: "growth",     label: "Growth" },
  { value: "cfo_lite",   label: "CFO-Lite" },
] as const;

export default function TenantSettingsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [name, setName]               = useState("");
  const [packageTier, setPackageTier] = useState("foundation");
  const [niche, setNiche]             = useState("");
  const [timezone, setTimezone]       = useState("");
  const [currency, setCurrency]       = useState("");
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [saved, setSaved]             = useState(false);

  useEffect(() => {
    if (!supabase) { setError("Missing Supabase env vars."); setLoading(false); return; }
    async function run() {
      const { data: userData } = await supabase!.auth.getUser();
      if (!userData.user) { router.replace("/login"); return; }

      const { data, error: fetchErr } = await supabase!
        .from("tenants")
        .select("name,package_tier,niche,timezone,currency")
        .eq("id", tenantId)
        .single();

      if (fetchErr || !data) { setError(fetchErr?.message ?? "Not found."); setLoading(false); return; }

      setName(data.name);
      setPackageTier(data.package_tier);
      setNiche(data.niche ?? "");
      setTimezone(data.timezone ?? "");
      setCurrency(data.currency ?? "");
      setLoading(false);
    }
    run();
  }, [supabase, tenantId, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }

    setSaving(true);
    setSaved(false);
    setError(null);

    const { data: sessionData } = await supabase!.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { router.replace("/login"); return; }

    const res = await fetch(`/api/tenants/${tenantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: name.trim(),
        package_tier: packageTier,
        niche: niche.trim() || null,
        timezone: timezone.trim() || null,
        currency: currency.trim() || null,
      }),
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok) { setError(json.error ?? "Failed to save."); return; }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-8">
        <div className="h-5 w-40 bg-zinc-100 rounded animate-pulse" />
        <div className="mt-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 space-y-4 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-9 bg-zinc-100 rounded" />)}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8">
      <div className="text-sm text-zinc-500">
        <Link href="/app" className="hover:underline">Tenants</Link>{" "}
        /{" "}
        <Link href={`/app/tenants/${tenantId}`} className="hover:underline">{name || tenantId}</Link>{" "}
        / <span className="text-zinc-900 font-medium">Settings</span>
      </div>

      <Card className="mt-4">
        <h1 className="text-lg font-semibold">Tenant settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Update client details and package tier.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <TextField label="Business name" value={name} onChange={setName} />

          <label className="block">
            <div className="text-sm font-medium">Package tier</div>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
              value={packageTier}
              onChange={(e) => setPackageTier(e.target.value)}
            >
              {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>

          <TextField label="Niche" value={niche} onChange={setNiche} />
          <TextField label="Timezone" value={timezone} onChange={setTimezone} />
          <TextField label="Currency" value={currency} onChange={setCurrency} />

          {error && <p className="text-sm text-red-700">{error}</p>}
          {saved && <p className="text-sm text-green-700">Changes saved.</p>}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            <Link href={`/app/tenants/${tenantId}`} className="text-sm text-zinc-500 hover:text-zinc-700">Cancel</Link>
          </div>
        </form>
      </Card>
    </main>
  );
}
