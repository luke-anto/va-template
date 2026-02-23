# VA Dashboard (MVP)

Internal operations dashboard for a productized VA + Accounting + BI service.

## What’s implemented
- Next.js app skeleton with:
  - `/login` (Supabase email/password sign-in)
  - `/app` (lists tenants assigned via `tenant_users`)
  - `/app/tenants/[tenantId]` (tenant detail shell)
- Supabase schema + RLS:
  - `supabase/schema.sql`
- Intake MVP:
  - `POST /api/intake/google-form` (service-role insert into `intake_events`)
  - Google Apps Script template: `integrations/google-forms/apps-script.gs`
- Monthly cycle task generator (admin-only token):
  - `POST /api/tenant/:tenantId/cycle/start`

## Setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Create at least one tenant row in `tenants`.
4. Create a Supabase Auth user for yourself (email/password).
5. Insert a `tenant_users` row mapping your `auth.users.id` to the tenant.
6. Copy `.env.example` to `.env.local` and fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `INTAKE_SHARED_SECRET`
   - `DASHBOARD_ADMIN_TOKEN`

## Dev
From `/Users/luke/Documents/Codex/va-dashboard-app`:
- `npm run dev`

## Notes
- This is an MVP focused on internal ops. Client portal, BI embedding, and advanced metrics come next.

