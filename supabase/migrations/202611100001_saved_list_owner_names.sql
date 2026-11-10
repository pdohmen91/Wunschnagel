begin;

-- Keep a recognizable name even if a saved link is later revoked or deleted.
alter table public.wishlist_bookmarks add column owner_name text
  check (owner_name is null or length(trim(owner_name)) between 1 and 100);

-- Only the display name belongs in a personal bookmark; never return auth IDs,
-- email addresses or the rest of the owner's account metadata.
create function public.wishlist_owner_name(list_owner uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    nullif(left(trim(u.raw_user_meta_data ->> 'full_name'), 100), ''),
    nullif(left(trim(u.raw_user_meta_data ->> 'name'), 100), '')
  ) from auth.users u where u.id = list_owner;
$$;
revoke all on function public.wishlist_owner_name(uuid) from public, anon, authenticated;

-- Backfill existing references only while their exact saved route still works.
update public.wishlist_bookmarks b set owner_name = public.wishlist_owner_name(l.owner_id)
from public.wishlists l where l.id = b.list_id
  and ((b.route_kind = 'public' and l.visibility = 'public')
    or (b.route_kind = 'token' and l.visibility = 'link' and l.share_token = b.route_value));

create or replace function public.get_wishlist_bookmarks(expected_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or expected_user is distinct from (select auth.uid()) then
    raise exception 'Bitte melde dich mit deinem Konto an.';
  end if;
  -- Only join currently accessible lists. After revocation, never expose a new
  -- private title/emoji/name; the bookmark retains its previously saved snapshot.
  return coalesce((select jsonb_agg(jsonb_build_object(
    'list_id', b.list_id, 'kind', b.route_kind, 'value', b.route_value,
    'title', coalesce(l.title, b.title), 'emoji', coalesce(l.emoji, b.emoji),
    'owner_name', case when l.id is not null then public.wishlist_owner_name(l.owner_id) else b.owner_name end,
    'saved_at', b.saved_at, 'available', l.id is not null) order by b.saved_at desc, b.list_id)
    from public.wishlist_bookmarks b left join public.wishlists l on l.id = b.list_id
      and ((b.route_kind = 'public' and l.visibility = 'public')
        or (b.route_kind = 'token' and l.visibility = 'link' and l.share_token = b.route_value))
    where b.user_id = (select auth.uid())), '[]'::jsonb);
end;
$$;

create or replace function public.save_wishlist_bookmark(bookmark_kind text, bookmark_value text, expected_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid()); target public.wishlists%rowtype; result public.wishlist_bookmarks%rowtype;
begin
  if caller is null or expected_user is distinct from caller then raise exception 'Bitte melde dich mit deinem Konto an.'; end if;
  if bookmark_kind = 'token' and bookmark_value ~ '^[a-f0-9]{64}$' then
    select * into target from public.wishlists where visibility = 'link' and share_token = bookmark_value for share;
  elsif bookmark_kind = 'public' and bookmark_value ~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$' then
    select * into target from public.wishlists where visibility = 'public' and id = bookmark_value::uuid for share;
  end if;
  if target.id is null then raise exception 'Diese Liste ist nicht mehr freigegeben oder der Link wurde erneuert.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bookmarks:' || caller::text, 0));
  if not exists(select 1 from public.wishlist_bookmarks where user_id = caller and list_id = target.id)
    and (select count(*) from public.wishlist_bookmarks where user_id = caller) >= 100 then
    raise exception 'Du kannst bis zu 100 Listen merken. Entferne zuerst einen alten Eintrag.' using errcode = '54000';
  end if;
  insert into public.wishlist_bookmarks(user_id, list_id, route_kind, route_value, title, emoji, owner_name)
    values(caller, target.id, bookmark_kind, case when bookmark_kind = 'public' then target.id::text else bookmark_value end, target.title, target.emoji, public.wishlist_owner_name(target.owner_id))
    on conflict(user_id, list_id) do update set route_kind = excluded.route_kind, route_value = excluded.route_value,
      title = excluded.title, emoji = excluded.emoji, owner_name = excluded.owner_name, saved_at = now()
    returning * into result;
  return jsonb_build_object('list_id', result.list_id, 'kind', result.route_kind, 'value', result.route_value,
    'title', result.title, 'emoji', result.emoji, 'owner_name', result.owner_name, 'saved_at', result.saved_at, 'available', true);
end;
$$;

commit;
