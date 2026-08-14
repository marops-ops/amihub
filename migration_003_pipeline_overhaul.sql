-- Migration: pipeline overhaul per RøhneSelmer brief
-- Drops the AI-classification / helpdesk model, replaces with the client's
-- explicit seller-driven pipeline.

-- ---- Remove fields from the dropped AI-classification model ----
alter table leads
  drop column if exists queue,
  drop column if exists temperature,
  drop column if exists ai_classification,
  drop column if exists classification_overridden,
  drop column if exists qualification,
  drop column if exists last_contacted_at,
  drop column if exists next_follow_up_at;

-- ---- New pipeline status ----
alter table leads drop constraint if exists leads_status_check;
alter table leads alter column status set default 'nye';
alter table leads add constraint leads_status_check
  check (status in ('nye','under_arbeid','oppfolging','vunnet','levert','ferdig','tapt'));

-- ---- New pipeline fields ----
alter table leads
  add column sub_status text check (sub_status in ('kunde_avventer')),
  add column accepted_at timestamptz,
  add column next_reminder_at timestamptz,
  add column last_activity_at timestamptz not null default now(),
  add column lost_type text check (lost_type in ('ikke_aktuelt','kunde_avslatt_tilbud')),
  add column lost_reason text,
  add column delivery_date timestamptz,
  add column delivery_reminder_sent boolean not null default false,
  add column delivered_at timestamptz,
  add column call_reminder_sent boolean not null default false,
  add column old_flag_notified boolean not null default false,
  add column handling_breach_notified boolean not null default false;

create index leads_status_idx on leads (organization_id, status);
create index leads_last_activity_idx on leads (organization_id, last_activity_at);

-- ---- Roles: drop helpdesk, use selger/salgsleder/admin ----
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('selger','salgsleder','admin'));

-- ---- lead_activities: expand event types for the new pipeline ----
alter table lead_activities drop constraint if exists lead_activities_activity_type_check;
alter table lead_activities add constraint lead_activities_activity_type_check
  check (activity_type in (
    'created','accepted','status_changed','sub_status_changed',
    'reassigned','reminder_sent','delivery_date_set','delivery_confirmed',
    'follow_up_call_registered','sla_breach','old_lead_flagged'
  ));

-- ---- lead_notes: separate from the immutable system activity log.
-- These are freeform, user-authored, timestamped and attributed, per brief.
create table lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  user_id uuid not null references users(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create index lead_notes_lead_idx on lead_notes (lead_id, created_at);

alter table lead_notes enable row level security;

create policy lead_notes_isolation on lead_notes
  for select using (
    exists (select 1 from leads l where l.id = lead_notes.lead_id and l.organization_id = auth_org_id())
  );

create policy lead_notes_insert on lead_notes
  for insert with check (
    exists (select 1 from leads l where l.id = lead_notes.lead_id and l.organization_id = auth_org_id())
  );

-- ---- Rewrite leads RLS to match the new three-role model ----
-- admin        -> full access within org
-- salgsleder   -> all leads at their assigned location(s)
-- selger       -> leads assigned to them, plus unclaimed 'nye' leads at their location(s)
drop policy if exists leads_select on leads;
drop policy if exists leads_update on leads;

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
