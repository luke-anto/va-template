# VA Dashboard — Claude Code Operating Manual

You are working on an internal operations dashboard for a productized VA + accounting service.
This is not a client-facing product. It is the operator's command center.

## What this is

A multi-tenant Next.js 15 app where an accounting VA manages:
- Client (tenant) onboarding and package tracking
- Monthly service cycles (collecting → processing → reconciling → reporting → delivered)
- Expense/income intake from Google Forms
- Cycle task checklists (8 default tasks per month per client)
- KPI visibility per client

## Tech Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Database + Auth:** Supabase (Postgres + RLS + email/password auth)
- **Styling:** Tailwind CSS
- **Dev server:** `npm run dev` from this directory
- **Key deps:** @supabase/supabase-js, zod, framer-motion, date-fns

## Directory Layout

```
src/
  app/
    api/
      intake/google-form/route.ts     ← intake webhook from Google Forms
      tenant/[tenantId]/cycle/start/route.ts ← starts a monthly cycle
    app/
      page.tsx                        ← tenant list (requires auth)
      tenants/[tenantId]/page.tsx     ← tenant detail (hub page)
    login/page.tsx
    layout.tsx
    globals.css
  components/ui/
    button.tsx
    card.tsx
    text-field.tsx
  lib/supabase/
    browser.ts                        ← createBrowserSupabaseClient()
    admin.ts                          ← createAdminSupabaseClient() (service role)
supabase/
  schema.sql                          ← full DB schema + RLS policies
integrations/
  google-forms/apps-script.gs        ← client-side Google Apps Script template
```

## Database Schema (key tables)

| Table | Purpose |
|-------|---------|
| `tenants` | Client businesses. `package_tier`: foundation / growth / cfo_lite |
| `tenant_users` | Maps auth users to tenants with roles |
| `service_cycles` | One row per tenant per month. Status: collecting → processing → reconciling → reporting → delivered → paused |
| `cycle_tasks` | 8 default tasks per cycle. Status: todo / in_progress / done |
| `intake_events` | Expenses/income submitted via Google Form. Status: new / categorized / posted |
| `transactions` | Finalized financial records |
| `budgets` | Monthly budget by category |
| `invoices` | Client invoices |
| `missing_data_alerts` | Flags when client hasn't submitted intake for a week |

## Coding Rules

1. **No ORM.** Use Supabase JS client from `@/lib/supabase/browser` or `@/lib/supabase/admin` only.
2. **Always filter by tenant_id** in every query — RLS enforces it at DB level but be explicit.
3. **Supabase client pattern:** Use `useMemo(() => createBrowserSupabaseClient(), [])` — never `useState(null)`.
4. **Auth guard:** Each protected client page checks `getUser()` and redirects to `/login` if no session.
5. **Admin API routes:** Protected by `x-admin-token` header checked against `DASHBOARD_ADMIN_TOKEN` env var.
6. **No new UI libraries.** Use the existing `Card`, `Button`, `TextField` components in `components/ui/`.
7. **Tailwind only.** No CSS modules, no inline styles, no styled-components.
8. **Status badge pattern:** Map enum → Tailwind class object, not inline ternaries.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
INTAKE_SHARED_SECRET
DASHBOARD_ADMIN_TOKEN
```

## What's Built

- [x] Login page (Supabase email/password)
- [x] Tenant list page (`/app`) — search, cycle status column, "New tenant" button, CSV export
- [x] New tenant form (`/app/new-tenant`) + `POST /api/tenants`
- [x] Tenant detail page (`/app/tenants/[tenantId]`) — KPI cards, service cycles + tasks, intake events, invoices, alerts, deliverables
- [x] Tenant settings page (`/app/tenants/[tenantId]/settings`) + `PATCH /api/tenants/[tenantId]`
- [x] Analytics/BI page (`/app/tenants/[tenantId]/analytics`) — recharts: revenue vs expenses, cash flow, BVA, expense breakdown, cycle completion, top expenses
- [x] Intake webhook (`POST /api/intake/google-form`)
- [x] Cycle start API (`POST /api/tenant/:id/cycle/start`)

## Directory Layout (updated)

```
src/app/
  app/
    page.tsx                            ← tenant list (search + cycle status)
    new-tenant/page.tsx                 ← new tenant form
    tenants/[tenantId]/
      page.tsx                          ← tenant detail hub
      settings/page.tsx                 ← tenant settings
      analytics/page.tsx                ← BI dashboard (recharts)
  api/
    tenants/route.ts                    ← POST create tenant
    tenants/[tenantId]/route.ts         ← PATCH update tenant
    intake/google-form/route.ts         ← intake webhook
    tenant/[tenantId]/cycle/start/route.ts
```

## What's Next (see TASK_QUEUE.md)

Remaining backlog: CYCLE-04 (cycle history page), TX-01 (transactions list), ENTITY-01 (entities list), REPORT-02 (monthly report generation).

## Project System Files

- Architecture decisions: `../Project Start/MEMORY/DECISION_LOG.md`
- Reusable patterns: `../Project Start/MEMORY/PATTERNS.md`
- Mistakes to avoid: `../Project Start/MEMORY/PITFALLS.md`
- Project context: `../Project Start/KNOWLEDGE/PROJECT_CONTEXT.md`
- Vision: `../Project Start/CORE/PROJECT_VISION.md`
- Task queue: `../Project Start/BUILD/TASK_QUEUE.md`

## How to Work

Give outcomes, not instructions. Examples:

**Good:** "Tenant page shows active service cycle with task checklist"
**Bad:** "Add a useEffect that fetches service_cycles and renders a ul"

After completing any feature, update `MEMORY/PATTERNS.md` or `MEMORY/PITFALLS.md` with anything learned.
