begin;
-- Keep historical idealo values readable for existing clients/data. The UI
-- no longer offers or renders automatic price comparisons for those values.
-- Explicitly configured used/custom searches remain available.
alter table public.wishes drop constraint wishes_offer_source_check;
alter table public.wishes add constraint wishes_offer_source_check
  check (offer_source in ('none', 'idealo', 'ebay', 'kleinanzeigen', 'custom'));
alter table public.wishes alter column offer_source set default 'none';
commit;
