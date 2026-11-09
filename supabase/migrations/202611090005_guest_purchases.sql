begin;

-- Gift coordination is intentionally separate from wishes/fulfilled. There is
-- no direct browser access, not even for the list owner or its editors.
create table public.wish_purchases (
  wish_id uuid primary key references public.wishes(id) on delete cascade,
  receipt_hash text not null check (receipt_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.wish_purchases enable row level security;
revoke all on public.wish_purchases from public, anon, authenticated;

-- Lock the list against revocation/visibility changes until the operation ends.
-- The owner cannot use purchase operations even when opening their own share URL.
create function public.gift_access(list_id uuid, read_token text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.wishlists l where l.id = list_id
    and l.owner_id is distinct from (select auth.uid())
    and (l.visibility = 'public' or (l.visibility = 'link' and read_token ~ '^[a-f0-9]{64}$' and l.share_token = read_token))
    for share;
  return found;
end;
$$;
revoke all on function public.gift_access(uuid, text) from public, anon, authenticated;

create function public.purchase_wish(list_id uuid, item_id uuid, read_token text, receipt text) returns text
language plpgsql security definer set search_path = '' as $$
declare saved_hash text; candidate_hash text;
begin
  if receipt is null or receipt !~ '^[a-f0-9]{64}$' or not public.gift_access(list_id, read_token) then
    raise exception 'Diese Kaufmarkierung ist nicht verfügbar.';
  end if;
  perform 1 from public.wishes w where w.id = item_id and w.wishlist_id = list_id and not w.fulfilled for share;
  if not found then raise exception 'Dieser Wunsch ist nicht mehr zum Schenken verfügbar.'; end if;
  candidate_hash := encode(extensions.digest(receipt, 'sha256'), 'hex');
  insert into public.wish_purchases(wish_id, receipt_hash) values (item_id, candidate_hash)
    on conflict (wish_id) do nothing returning receipt_hash into saved_hash;
  if saved_hash is not null then return 'purchased'; end if;
  -- Idempotent retries (including a lost response) retain the original receipt.
  select receipt_hash into saved_hash from public.wish_purchases where wish_id = item_id;
  if saved_hash = candidate_hash then return 'purchased'; end if;
  return 'already_purchased';
end;
$$;

create function public.undo_wish_purchase(list_id uuid, item_id uuid, read_token text, receipt text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if receipt is null or receipt !~ '^[a-f0-9]{64}$' or not public.gift_access(list_id, read_token) then
    raise exception 'Diese Kaufmarkierung ist nicht verfügbar.';
  end if;
  -- Same lock order as marking, wish editing and deletion: list, wish, purchase.
  perform 1 from public.wishes w where w.id = item_id and w.wishlist_id = list_id for share;
  if not found then return false; end if;
  delete from public.wish_purchases p where p.wish_id = item_id
    and p.receipt_hash = encode(extensions.digest(receipt, 'sha256'), 'hex');
  return found;
end;
$$;
revoke all on function public.purchase_wish(uuid, uuid, text, text), public.undo_wish_purchase(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.purchase_wish(uuid, uuid, text, text), public.undo_wish_purchase(uuid, uuid, text, text) to anon, authenticated;

-- A received gift or a changed product is a new gift situation. Editing notes,
-- images or prices alone does not clear another guest's purchase.
create function public.reset_wish_purchase() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.fulfilled is distinct from old.fulfilled or new.url is distinct from old.url then
    delete from public.wish_purchases where wish_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.reset_wish_purchase() from public, anon, authenticated;
create trigger reset_wish_purchase after update of fulfilled, url on public.wishes
  for each row execute function public.reset_wish_purchase();

-- Only the guest projection contains purchased. Ordinary list/item queries and
-- the authenticated owner's shared projection contain no purchase information.
create or replace function public.read_wishlist_payload(list_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'list', jsonb_build_object('id', l.id, 'title', l.title, 'description', l.description,
      'emoji', l.emoji, 'visibility', l.visibility, 'created_at', l.created_at),
    'can_purchase', l.owner_id is distinct from (select auth.uid()),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', w.id, 'wishlist_id', w.wishlist_id, 'title', w.title, 'url', w.url,
      'notes', w.notes, 'image_url', w.image_url, 'price', w.price, 'fulfilled', w.fulfilled,
      'created_at', w.created_at, 'offer_source', w.offer_source, 'search_term', w.search_term,
      'search_url', w.search_url) || case when l.owner_id is distinct from (select auth.uid())
        then jsonb_build_object('purchased', exists(select 1 from public.wish_purchases p where p.wish_id = w.id))
        else '{}'::jsonb end order by w.created_at, w.id)
      from public.wishes w where w.wishlist_id = l.id), '[]'::jsonb)
  ) from public.wishlists l where l.id = list_id;
$$;
revoke all on function public.read_wishlist_payload(uuid) from public, anon, authenticated;

commit;
