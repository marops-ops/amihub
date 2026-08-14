-- WARNING: destructive. Drops all CRM tables and data. Only for dev/reset.
drop table if exists marketing_contacts cascade;
drop table if exists lead_activities cascade;
drop table if exists leads cascade;
drop table if exists user_locations cascade;
drop table if exists users cascade;
drop table if exists locations cascade;
drop table if exists organizations cascade;

drop function if exists auth_org_id() cascade;
drop function if exists auth_role() cascade;
drop function if exists auth_location_ids() cascade;
drop function if exists set_updated_at() cascade;
