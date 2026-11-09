begin;
-- A separate value keeps existing used-only eBay searches unchanged.
alter table public.wishes drop constraint wishes_offer_source_check;
alter table public.wishes add constraint wishes_offer_source_check
  check (offer_source in ('none', 'idealo', 'ebay_all', 'ebay', 'kleinanzeigen', 'custom'));
commit;
