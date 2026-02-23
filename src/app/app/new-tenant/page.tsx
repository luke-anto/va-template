"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";

const TIERS = [
  { value: "foundation", label: "Foundation" },
  { value: "growth", label: "Growth" },
  { value: "cfo_lite", label: "CFO-Lite" },
] as const;

export default function NewTenantPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [name, setName] = useState("");
  const [packageTier, setPackageTier] = useState<string>("foundation");
  const [niche, setNiche] = useState("");
  const [timezone, setTimezone] = useState("");
  const [currency, setCurrency] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setStatus("error");
      setErrorMessage("Name is required.");
      return;
    }

    if (!supabase) {
      setStatus("error");
      setErrorMessage("Missing Supabase env vars.");
      return;
    }

    setStatus("saving");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      router.replace("/login");
      return;
    }

    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: name.trim(),
        package_tier: packageTier,
        niche: niche.trim(),
        timezone: timezone.trim(),
        currency: currency.trim(),
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      setStatus("error");
      setErrorMessage(json.error ?? "Failed to create tenant.");
      return;
    }

    router.push(`/app/tenants/${json.tenant.id}`);
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8">
      <Link href="/app" className="text-sm text-zinc-500 hover:text-zinc-700">
        &larr; Back to tenants
      </Link>

      <Card className="mt-4">
        <h1 className="text-xl font-semibold">New tenant</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Create a client and assign yourself as owner.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <TextField label="Business name" value={name} onChange={setName} />

          <label className="block">
            <div className="text-sm font-medium">Package tier</div>
            <select
              className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-[#141414] text-[#f0f0f0] px-3 py-2 text-sm outline-none focus:border-[#0057ff] transition-colors"
              value={packageTier}
              onChange={(e) => setPackageTier(e.target.value)}
            >
              {TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <TextField label="Niche" value={niche} onChange={setNiche} />
          <TextField label="Timezone" value={timezone} onChange={setTimezone} />
          <TextField label="Currency" value={currency} onChange={setCurrency} />

          {errorMessage && (
            <p className="text-sm text-red-700">{errorMessage}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Creating..." : "Create tenant"}
            </Button>
            <Link
              href="/app"
              className="text-sm text-zinc-500 hover:text-zinc-700"
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </main>
  );
}
