-- Migration: lead follow-up & qualification tracking
-- Run after schema.sql (and seed.sql if already applied)

alter table leads
  add column qualification text not null default 'unqualified'
    check (qualification in ('unqualified','qualified','disqualified')),
  add column last_contacted_at timestamptz,
  add column next_follow_up_at timestamptz;

alter table lead_activities
  drop constraint lead_activities_activity_type_check;

alter table lead_activities
  add constraint lead_activities_activity_type_check
  check (activity_type in (
    'created','classified','queue_changed','temperature_changed',
    'claimed','note_added','status_changed',
    'contact_logged','qualification_changed','follow_up_set'
  ));

create index leads_follow_up_idx on leads (organization_id, next_follow_up_at);
