begin;

alter table public.wishes
  add column offer_source text not null default 'idealo' check (offer_source in ('idealo', 'ebay', 'kleinanzeigen', 'custom')),
  add column search_term text not null default '' check (length(search_term) <= 200),
  add column search_url text not null default '' check (length(search_url) <= 2000 and (search_url = '' or search_url ~ '^https?://[^[:space:]]+$')),
  add constraint wishes_custom_offer_url check (offer_source <> 'custom' or search_url <> '');

-- Existing ownership policies apply to these fields too. Shared read RPCs
-- already serialize complete wish rows, including the search configuration.
commit;
