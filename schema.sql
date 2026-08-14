-- ============================================================
-- Multi-tenant Lead CRM — Database Schema (consolidated, post pipeline-overhaul)
-- Target: Supabase (Postgres)
-- For an existing database, use the numbered migration files instead —
-- this file reflects the end state, useful for fresh installs.
-- ============================================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  vertical text not null check (vertical in ('automotive','ecommerce','travel','generic')),
  logo_url text,
  terminology jsonb not null default '{}'::jsonb,
  classification_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('selger','salgsleder','admin')),
  created_at timestamptz not null default now()
);

create table user_locations (
  user_id uuid not null references users(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  primary key (user_id, location_id)
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,

  first_name text,
  last_name text,
  email text,
  phone text,

  message text,
  product_category text,
  product_name text,
  product_variant text,

  source_channel text not null check (source_channel in ('website','meta','google','manual')),
  source_url text,
  external_lead_id text,
  raw_payload jsonb,

  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,

  -- Pipeline: nye -> under_arbeid -> oppfolging -> vunnet -> levert -> ferdig
  -- Alternative endings: tapt (via lost_type: ikke_aktuelt | kunde_avslatt_tilbud)
  status text not null default 'nye'
    check (status in ('nye','under_arbeid','oppfolging','vunnet','levert','ferdig','tapt')),
  sub_status text check (sub_status in ('kunde_avventer')),

  accepted_at timestamptz,
  next_reminder_at timestamptz,
  last_activity_at timestamptz not null default now(),

  lost_type text check (lost_type in ('ikke_aktuelt','kunde_avslatt_tilbud')),
  lost_reason text,

  delivery_date timestamptz,
  delivery_reminder_sent boolean not null default false,
  delivered_at timestamptz,
  call_reminder_sent boolean not null default false,

  old_flag_notified boolean not null default false,
  handling_breach_notified boolean not null default false,

  assigned_to uuid references users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index leads_external_id_unique
  on leads (organization_id, external_lead_id)
  where external_lead_id is not null;

create index leads_org_location_status_idx on leads (organization_id, location_id, status);
create index leads_status_idx on leads (organization_id, status);
create index leads_last_activity_idx on leads (organization_id, last_activity_at);

create table lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  activity_type text not null check (activity_type in (
    'created','accepted','status_changed','sub_status_changed',
    'reassigned','reminder_sent','delivery_date_set','delivery_confirmed',
    'follow_up_call_registered','sla_breach','old_lead_flagged'
  )),
  old_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index lead_activities_lead_idx on lead_activities (lead_id, created_at);

-- Freeform, user-authored notes — separate from the immutable system log.
create table lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create index lead_notes_lead_idx on lead_notes (lead_id, created_at);

create table marketing_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  first_name text,
  last_name text,
  email text,
  phone text,
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger leads_set_updated_at
before update on leads
for each row execute function set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

create or replace function auth_org_id()
returns uuid as $$
  select organization_id from users where id = auth.uid();
$$ language sql stable security definer;

create or replace function auth_role()
returns text as $$
  select role from users where id = auth.uid();
$$ language sql stable security definer;

create or replace function auth_location_ids()
returns uuid[] as $$
  select array_agg(location_id) from user_locations where user_id = auth.uid();
$$ language sql stable security definer;

alter table organizations enable row level security;
alter table locations enable row level security;
alter table users enable row level security;
alter table user_locations enable row level security;
alter table leads enable row level security;
alter table lead_activities enable row level security;
alter table lead_notes enable row level security;
alter table marketing_contacts enable row level security;

create policy org_isolation on organizations
  for select using (id = auth_org_id());

create policy locations_isolation on locations
  for select using (organization_id = auth_org_id());

create policy users_isolation on users
  for select using (organization_id = auth_org_id());

create policy user_locations_isolation on user_locations
  for select using (
    exists (select 1 from users u where u.id = user_locations.user_id and u.organization_id = auth_org_id())
  );

-- admin        -> full access within org
-- salgsleder   -> all leads at their assigned location(s)
-- selger       -> leads assigned to them, plus unclaimed 'nye' leads at their location(s)
create policy leads_select on leads
  for select using (
    organization_id = auth_org_id()
    and (
      auth_role() = 'admin'
      or (auth_role() = 'salgsleder' and location_id = any(auth_location_ids()))
      or (auth_role() = 'selger' and (
            assigned_to = auth.uid()
            or (status = 'nye' and location_id = any(auth_location_ids()))
          ))
    )
  );

create policy leads_update on leads
  for update using (
    organization_id = auth_org_id()
    and (
      auth_role() = 'admin'
      or (auth_role() = 'salgsleder' and location_id = any(auth_location_ids()))
      or (auth_role() = 'selger' and (
            assigned_to = auth.uid()
            or (status = 'nye' and location_id = any(auth_location_ids()))
          ))
    )
  );

create policy leads_insert on leads
  for insert with check (organization_id = auth_org_id());

create policy lead_activities_isolation on lead_activities
  for select using (
    exists (select 1 from leads l where l.id = lead_activities.lead_id and l.organization_id = auth_org_id())
  );

create policy lead_activities_insert on lead_activities
  for insert with check (
    exists (select 1 from leads l where l.id = lead_activities.lead_id and l.organization_id = auth_org_id())
  );

create policy lead_notes_isolation on lead_notes
  for select using (
    exists (select 1 from leads l where l.id = lead_notes.lead_id and l.organization_id = auth_org_id())
  );

create policy lead_notes_insert on lead_notes
  for insert with check (
    exists (select 1 from leads l where l.id = lead_notes.lead_id and l.organization_id = auth_org_id())
  );

create policy marketing_contacts_isolation on marketing_contacts
  for select using (organization_id = auth_org_id() and auth_role() = 'admin');
