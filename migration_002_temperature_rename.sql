-- Migration: temperature terminology change
-- Old scale: kald / varm / het
-- New scale: kald / lunken / varm  (each old value shifts up one notch)

alter table leads drop constraint if exists leads_temperature_check;

update leads set temperature = case temperature
  when 'het' then 'varm'
  when 'varm' then 'lunken'
  else temperature
end;

alter table leads add constraint leads_temperature_check
  check (temperature in ('kald','lunken','varm'));
