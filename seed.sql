-- Run this after schema.sql to get test data for the intake pipeline.

insert into organizations (name, slug, vertical, classification_config)
values (
  'RøhneSelmer',
  'rohneselmer',
  'automotive',
  '{"hints": "Bilforhandler med flere merker. Prøvekjøring er sterkt kjøpssignal."}'::jsonb
);

insert into locations (organization_id, name)
select id, unnest(array['Oslo', 'Lillestrøm', 'Asker og Bærum', 'Drammen og Lier'])
from organizations where slug = 'rohneselmer';
