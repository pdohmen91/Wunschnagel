begin;

-- Add the safe public API before deploying the frontend that uses it.
create function public.read_wishlist_payload(list_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'list', jsonb_build_object('id', l.id, 'title', l.title, 'description', l.description,
      'emoji', l.emoji, 'visibility', l.visibility, 'created_at', l.created_at),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', w.id, 'wishlist_id', w.wishlist_id, 'title', w.title, 'url', w.url,
      'notes', w.notes, 'image_url', w.image_url, 'price', w.price, 'fulfilled', w.fulfilled,
      'created_at', w.created_at, 'offer_source', w.offer_source, 'search_term', w.search_term,
      'search_url', w.search_url) order by w.created_at, w.id)
      from public.wishes w where w.wishlist_id = l.id), '[]'::jsonb)
  ) from public.wishlists l where l.id = list_id;
$$;
-- This helper bypasses RLS; it is never a public API.
revoke all on function public.read_wishlist_payload(uuid) from public, anon, authenticated;

create or replace function public.get_shared_wishlist(token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.read_wishlist_payload(l.id) from public.wishlists l
    where l.share_token = token and l.visibility = 'link' and token ~ '^[a-f0-9]{64}$';
$$;
create function public.get_public_wishlist(list_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.read_wishlist_payload(l.id) from public.wishlists l
    where l.id = list_id and l.visibility = 'public';
$$;
revoke all on function public.get_shared_wishlist(text), public.get_public_wishlist(uuid) from public, anon, authenticated;
grant execute on function public.get_shared_wishlist(text), public.get_public_wishlist(uuid) to anon, authenticated;

commit;
