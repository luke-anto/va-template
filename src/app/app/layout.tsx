"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserSupabaseClient();

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // Derive a section label from the pathname
  const section = (() => {
    if (pathname === "/app") return "Clients";
    if (pathname === "/app/new-tenant") return "New client";
    if (pathname.includes("/analytics")) return "Analytics";
    if (pathname.includes("/cycles")) return "Cycle history";
    if (pathname.includes("/transactions")) return "Transactions";
    if (pathname.includes("/entities")) return "Entities";
    if (pathname.includes("/settings")) return "Settings";
    if (pathname.match(/\/app\/tenants\/[^/]+$/)) return "Client detail";
    return "Dashboard";
  })();

  return (
    <div className="min-h-dvh flex flex-col bg-[#0a0a0a]">
      {/* ── Top navigation bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between gap-4 border-b border-[#1e1e1e] bg-[#0a0a0a]/90 px-4 backdrop-blur-md">
        {/* Brand */}
        <Link
          href="/app"
          className="flex items-center gap-2.5 text-sm font-semibold text-[#f0f0f0] hover:text-white transition-colors"
        >
          {/* Holo accent dot */}
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0057ff] shadow-[0_0_10px_rgba(0,87,255,0.5)]">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4" height="4" rx="1" fill="white" opacity="0.9" />
              <rect x="7" y="1" width="4" height="4" rx="1" fill="white" opacity="0.5" />
              <rect x="1" y="7" width="4" height="4" rx="1" fill="white" opacity="0.5" />
              <rect x="7" y="7" width="4" height="4" rx="1" fill="white" opacity="0.9" />
            </svg>
          </span>
          VA&nbsp;Dashboard
        </Link>

        {/* Section indicator */}
        <span className="hidden sm:block text-xs text-[#555] font-medium tracking-wide uppercase">
          {section}
        </span>

        {/* Right: sign out */}
        <button
          onClick={handleSignOut}
          className="text-xs text-[#555] hover:text-[#a0a0a0] transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
