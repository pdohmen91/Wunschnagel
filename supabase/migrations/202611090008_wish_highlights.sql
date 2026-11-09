begin;

alter table public.wishes add column highlighted boolean not null default false;
grant insert (highlighted), update (highlighted) on public.wishes to authenticated;

create or replace function public.read_wishlist_payload(list_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'list', jsonb_build_object('id', l.id, 'title', l.title, 'description', l.description,
      'emoji', l.emoji, 'visibility', l.visibility, 'created_at', l.created_at),
    'can_purchase', l.owner_id is distinct from (select auth.uid()),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', w.id, 'wishlist_id', w.wishlist_id, 'title', w.title, 'url', w.url,
      'notes', w.notes, 'image_url', w.image_url, 'price', w.price, 'fulfilled', w.fulfilled, 'highlighted', w.highlighted,
      'created_at', w.created_at, 'offer_source', w.offer_source, 'search_term', w.search_term,
      'search_url', w.search_url) || case when l.owner_id is distinct from (select auth.uid())
        then jsonb_build_object('purchased', exists(select 1 from public.wish_purchases p where p.wish_id = w.id))
        else '{}'::jsonb end order by w.created_at, w.id)
      from public.wishes w where w.wishlist_id = l.id), '[]'::jsonb)
  ) from public.wishlists l where l.id = list_id;
$$;
revoke all on function public.read_wishlist_payload(uuid) from public, anon, authenticated;


commit;
