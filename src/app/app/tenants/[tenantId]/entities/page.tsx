"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

// ─── Types ────────────────────────────────────────────────────────────────────

type Entity = {
  id: string;
  entity_id: string;
  name: string;
  type: string;
  email: string | null;
  terms: string | null;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  Customer: "bg-blue-100 text-blue-700",
  Vendor:   "bg-orange-100 text-orange-700",
  Partner:  "bg-purple-100 text-purple-700",
};

const ENTITY_TYPES = ["Customer", "Vendor", "Partner"] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EntitiesPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [tenantName, setTenantName]       = useState("");
  const [entities, setEntities]           = useState<Entity[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [search, setSearch]               = useState("");
  const [typeFilter, setTypeFilter]       = useState("all");
  const [showForm, setShowForm]           = useState(false);
  const [saving, setSaving]               = useState(false);
  const [formError, setFormError]         = useState<string | null>(null);

  // Form state
  const [fName, setFName]   = useState("");
  const [fType, setFType]   = useState<"Customer" | "Vendor" | "Partner">("Customer");
  const [fEmail, setFEmail] = useState("");
  const [fTerms, setFTerms] = useState("");

  const load = useCallback(async () => {
    if (!supabase) { setError("Missing Supabase env vars."); setLoading(false); return; }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { router.replace("/login"); return; }

    const [tenantRes, entRes] = await Promise.all([
      supabase.from("tenants").select("name").eq("id", tenantId).single(),
      supabase.from("entities").select("id,entity_id,name,type,email,terms,created_at").eq("tenant_id", tenantId).order("name"),
    ]);

    if (tenantRes.error || !tenantRes.data) { setError("Tenant not found."); setLoading(false); return; }
    setTenantName(tenantRes.data.name);
    setEntities(entRes.data ?? []);
    setLoading(false);
  }, [supabase, tenantId, router]);

  useEffect(() => { load(); }, [load]);

  const filtered = entities.filter((e) => {
    const matchesType   = typeFilter === "all" || e.type === typeFilter;
    const q             = search.toLowerCase();
    const matchesSearch = !q || e.name.toLowerCase().includes(q) || (e.email ?? "").toLowerCase().includes(q) || e.entity_id.toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  async function handleAdd(ev: React.FormEvent) {
    ev.preventDefault();
    if (!fName.trim()) { setFormError("Name is required."); return; }
    if (!supabase) return;
    setSaving(true);
    setFormError(null);

    // Generate a simple entity_id
    const prefix = fType === "Customer" ? "C" : fType === "Vendor" ? "V" : "P";
    const newId  = `${prefix}-${Date.now().toString().slice(-6)}`;

    const { data, error: insertErr } = await supabase
      .from("entities")
      .insert({
        tenant_id: tenantId,
        entity_id: newId,
        name:      fName.trim(),
        type:      fType,
        email:     fEmail.trim() || null,
        terms:     fTerms.trim() || null,
      })
      .select("id,entity_id,name,type,email,terms,created_at")
      .single();

    setSaving(false);

    if (insertErr || !data) { setFormError(insertErr?.message ?? "Failed to add."); return; }

    setEntities((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setShowForm(false);
    setFName(""); setFType("Customer"); setFEmail(""); setFTerms("");
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 space-y-3">
        <div className="h-5 w-48 bg-zinc-100 rounded animate-pulse" />
        <div className="h-12 bg-zinc-100 rounded-xl animate-pulse" />
        {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-zinc-100 rounded animate-pulse" />)}
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
        / <span className="text-zinc-900 font-medium">Entities</span>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold text-zinc-900">Entities</h1>
        <Button onClick={() => { setShowForm((v) => !v); setFormError(null); }}>
          {showForm ? "Cancel" : "+ Add entity"}
        </Button>
      </div>

      {error && <Card><p className="text-sm text-red-700">{error}</p></Card>}

      {/* Add form */}
      {showForm && (
        <Card>
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">New entity</h2>
          <form className="space-y-4" onSubmit={handleAdd}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Name" value={fName} onChange={setFName} />
              <label className="block">
                <div className="text-sm font-medium">Type</div>
                <select
                  value={fType}
                  onChange={(e) => setFType(e.target.value as typeof fType)}
                  className="mt-1 w-full rounded-md border border-[#2a2a2a] bg-[#141414] text-[#f0f0f0] px-3 py-2 text-sm outline-none focus:border-[#0057ff] transition-colors"
                >
                  {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <TextField label="Email" value={fEmail} onChange={setFEmail} />
              <TextField label="Payment terms" value={fTerms} onChange={setFTerms} />
            </div>
            {formError && <p className="text-sm text-red-700">{formError}</p>}
            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add entity"}</Button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-zinc-500 hover:text-zinc-700">Cancel</button>
            </div>
          </form>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-md border border-[#2a2a2a] bg-[#141414] text-[#f0f0f0] placeholder:text-[#505050] px-3 py-2 text-sm outline-none focus:border-[#0057ff] transition-colors"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-[#2a2a2a] bg-[#141414] text-[#f0f0f0] px-3 py-2 text-sm outline-none focus:border-[#0057ff] transition-colors"
        >
          <option value="all">All types</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-sm text-zinc-400 shrink-0">{filtered.length} of {entities.length}</span>
      </div>

      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-10">
            {entities.length === 0 ? "No entities yet. Add your first customer or vendor." : "No entities match your filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">ID</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Terms</th>
                  <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Added</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, idx) => (
                  <tr key={e.id} className={`border-b border-zinc-50 hover:bg-zinc-50/50 ${idx % 2 === 0 ? "" : "bg-zinc-50/30"}`}>
                    <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{e.entity_id}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{e.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[e.type] ?? "bg-zinc-100 text-zinc-500"}`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{e.email ?? <span className="text-zinc-300">—</span>}</td>
                    <td className="px-4 py-3 text-zinc-500">{e.terms ?? <span className="text-zinc-300">—</span>}</td>
                    <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                      {(() => { try { return format(new Date(e.created_at), "MMM d, yyyy"); } catch { return ""; } })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  );
}
