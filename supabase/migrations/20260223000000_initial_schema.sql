-- VA Dashboard: Multi-tenant schema + RLS (v1.0)
-- Run this in Supabase SQL editor.
--
-- Notes:
-- - This schema uses a `tenants` table to represent client businesses.
-- - User access is managed via `tenant_users` (auth.uid() membership).
-- - RLS is enabled on all tenant-scoped tables.

-- Extensions (safe to run multiple times)
create extension if not exists "uuid-ossp";

-- Enums
do $$ begin
  create type package_tier as enum ('foundation', 'growth', 'cfo_lite');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tenant_user_role as enum ('owner', 'internal_admin', 'bookkeeper', 'analyst', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type transaction_status as enum ('Planned', 'Sent', 'Received', 'Paid', 'Cancelled', 'Reconciled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type crm_stage as enum ('Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum ('New', 'Attempted', 'Booked', 'Completed', 'Cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('Pending', 'Active', 'Blocked', 'Completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_health as enum ('Green', 'Yellow', 'Red');
exception when duplicate_object then null; end $$;

do $$ begin
  create type service_cycle_status as enum ('collecting', 'processing', 'reconciling', 'reporting', 'delivered', 'paused');
exception when duplicate_object then null; end $$;

do $$ begin
  create type intake_status as enum ('new', 'categorized', 'posted');
exception when duplicate_object then null; end $$;

-- Core tenancy
create table if not exists tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  package_tier package_tier not null default 'foundation',
  niche text,
  timezone text,
  currency text,
  created_at timestamptz not null default now()
);

create table if not exists tenant_users (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null,
  role tenant_user_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- Helper function: membership check
create or replace function is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from tenant_users tu
    where tu.tenant_id = p_tenant_id
      and tu.user_id = auth.uid()
  );
$$;

-- Business entities
create table if not exists entities (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  entity_id text not null, -- e.g. ENT-101
  name text not null,
  type text not null check (type in ('Customer', 'Vendor', 'Partner')),
  email text,
  terms text,
  created_at timestamptz not null default now(),
  unique (tenant_id, entity_id)
);

create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  category_id text not null, -- e.g. 1100
  category_name text not null,
  code text,
  type text not null check (type in ('Rev', 'Exp', 'Ast', 'Liab')),
  created_at timestamptz not null default now(),
  unique (tenant_id, category_id)
);

create table if not exists accounts (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  account_id text not null,
  name text not null,
  initial_cash numeric(15,2),
  created_at timestamptz not null default now(),
  unique (tenant_id, account_id)
);

create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  date date not null,
  description text not null,
  category_id text not null,
  amount numeric(15,2) not null,
  entity_id text,
  status transaction_status not null default 'Planned',
  created_at timestamptz not null default now()
);

create table if not exists budgets (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  category_id text not null,
  month date not null, -- use first day of month
  budgeted_amount numeric(15,2) not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, category_id, month)
);

create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  invoice_id text,
  entity_id text,
  date date,
  due_date date,
  amount numeric(15,2),
  status text,
  created_at timestamptz not null default now()
);

-- CRM
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  lead_id text not null,
  entity_id text,
  lead_source text,
  date_generated date,
  lead_status lead_status not null default 'New',
  created_at timestamptz not null default now(),
  unique (tenant_id, lead_id)
);

create table if not exists opportunities (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  opp_id text not null,
  lead_id text,
  amount numeric(15,2),
  stage crm_stage not null default 'Discovery',
  probability numeric(5,2),
  exp_close_date date,
  updated_at timestamptz not null default now(),
  unique (tenant_id, opp_id)
);

-- Ops
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  project_id text not null,
  opp_id text,
  entity_id text,
  start_date date,
  due_date date,
  project_health project_health not null default 'Green',
  created_at timestamptz not null default now(),
  unique (tenant_id, project_id)
);

create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  task_id text not null,
  project_id text,
  assigned_to text,
  due_date date,
  status task_status not null default 'Pending',
  created_at timestamptz not null default now(),
  unique (tenant_id, task_id)
);

-- Service operations
create table if not exists service_engagements (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  start_date date,
  billing_type text,
  monthly_retainer numeric(15,2),
  setup_fee numeric(15,2),
  status text,
  created_at timestamptz not null default now()
);

create table if not exists service_cycles (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  month date not null, -- first day of month
  status service_cycle_status not null default 'collecting',
  created_at timestamptz not null default now(),
  unique (tenant_id, month)
);

create table if not exists cycle_tasks (
  id uuid primary key default uuid_generate_v4(),
  service_cycle_id uuid not null references service_cycles(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  task_type text not null,
  assignee text,
  status text not null default 'todo',
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists deliverables (
  id uuid primary key default uuid_generate_v4(),
  service_cycle_id uuid not null references service_cycles(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  type text not null,
  url text,
  created_at timestamptz not null default now()
);

-- Intake events (Google Form MVP)
create table if not exists intake_events (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  source text not null, -- form_in, form_out, whatsapp_manual, etc.
  date date,
  amount numeric(15,2),
  description text,
  attachment_url text,
  raw_payload jsonb,
  status intake_status not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists missing_data_alerts (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  week_start date not null,
  missing_receipts_count int not null default 0,
  last_submission_at timestamptz,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  unique (tenant_id, week_start)
);

-- RLS enablement
alter table tenants enable row level security;
alter table tenant_users enable row level security;
alter table entities enable row level security;
alter table categories enable row level security;
alter table accounts enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table invoices enable row level security;
alter table leads enable row level security;
alter table opportunities enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table service_engagements enable row level security;
alter table service_cycles enable row level security;
alter table cycle_tasks enable row level security;
alter table deliverables enable row level security;
alter table intake_events enable row level security;
alter table missing_data_alerts enable row level security;

-- Policies
-- Tenants: user can read tenant if they are a member
drop policy if exists "tenants_select_member" on tenants;
create policy "tenants_select_member" on tenants
for select using (is_tenant_member(id));

-- Tenant users: user can read their own memberships
drop policy if exists "tenant_users_select_self" on tenant_users;
create policy "tenant_users_select_self" on tenant_users
for select using (user_id = auth.uid());

-- Tenant-scoped tables: member can select/insert/update/delete
create or replace function create_member_policies(p_table regclass, p_tenant_col text)
returns void
language plpgsql
as $$
begin
  execute format('drop policy if exists %I on %s', p_table::text || '_select_member', p_table);
  execute format('create policy %I on %s for select using (is_tenant_member(%I))', p_table::text || '_select_member', p_table, p_tenant_col);

  execute format('drop policy if exists %I on %s', p_table::text || '_insert_member', p_table);
  execute format('create policy %I on %s for insert with check (is_tenant_member(%I))', p_table::text || '_insert_member', p_table, p_tenant_col);

  execute format('drop policy if exists %I on %s', p_table::text || '_update_member', p_table);
  execute format('create policy %I on %s for update using (is_tenant_member(%I)) with check (is_tenant_member(%I))', p_table::text || '_update_member', p_table, p_tenant_col, p_tenant_col);

  execute format('drop policy if exists %I on %s', p_table::text || '_delete_member', p_table);
  execute format('create policy %I on %s for delete using (is_tenant_member(%I))', p_table::text || '_delete_member', p_table, p_tenant_col);
end $$;

-- Apply policies to each tenant-scoped table
select create_member_policies('entities'::regclass, 'tenant_id');
select create_member_policies('categories'::regclass, 'tenant_id');
select create_member_policies('accounts'::regclass, 'tenant_id');
select create_member_policies('transactions'::regclass, 'tenant_id');
select create_member_policies('budgets'::regclass, 'tenant_id');
select create_member_policies('invoices'::regclass, 'tenant_id');
select create_member_policies('leads'::regclass, 'tenant_id');
select create_member_policies('opportunities'::regclass, 'tenant_id');
select create_member_policies('projects'::regclass, 'tenant_id');
select create_member_policies('tasks'::regclass, 'tenant_id');
select create_member_policies('service_engagements'::regclass, 'tenant_id');
select create_member_policies('service_cycles'::regclass, 'tenant_id');
select create_member_policies('cycle_tasks'::regclass, 'tenant_id');
select create_member_policies('deliverables'::regclass, 'tenant_id');
select create_member_policies('intake_events'::regclass, 'tenant_id');
select create_member_policies('missing_data_alerts'::regclass, 'tenant_id');

-- Cleanup helper (optional)
-- drop function create_member_policies(regclass, text);

