-- Seed demo data (optional)
-- Requires you to replace USER_ID with your auth.users UUID.

insert into tenants (id, name, package_tier, niche, timezone, currency)
values ('11111111-1111-1111-1111-111111111111', 'Demo Salon', 'growth', 'beauty', 'America/New_York', 'USD')
on conflict do nothing;

-- Replace USER_ID before running.
-- insert into tenant_users (tenant_id, user_id, role)
-- values ('11111111-1111-1111-1111-111111111111', 'USER_ID', 'internal_admin')
-- on conflict do nothing;

insert into categories (tenant_id, category_id, category_name, code, type)
values
  ('11111111-1111-1111-1111-111111111111', '1100', 'Service Revenue', '1100', 'Rev'),
  ('11111111-1111-1111-1111-111111111111', '2100', 'Service Supplies', '2100', 'Exp'),
  ('11111111-1111-1111-1111-111111111111', '3100', 'Facilities', '3100', 'Exp')
on conflict do nothing;

insert into entities (tenant_id, entity_id, name, type, email)
values
  ('11111111-1111-1111-1111-111111111111', 'ENT-000', 'System', 'Partner', null),
  ('11111111-1111-1111-1111-111111111111', 'ENT-101', 'Client A', 'Customer', null),
  ('11111111-1111-1111-1111-111111111111', 'ENT-003', 'Supplier A', 'Vendor', null)
on conflict do nothing;

insert into transactions (tenant_id, date, description, category_id, amount, entity_id, status)
values
  ('11111111-1111-1111-1111-111111111111', '2026-02-01', 'Opening Balance Setup', '3100', 500.00, 'ENT-000', 'Reconciled'),
  ('11111111-1111-1111-1111-111111111111', '2026-02-05', 'Salon Rent (February)', '3100', -1200.00, 'ENT-003', 'Paid'),
  ('11111111-1111-1111-1111-111111111111', '2026-02-10', 'Service: Classic Lash Full Set', '1100', 120.00, 'ENT-101', 'Reconciled')
;

