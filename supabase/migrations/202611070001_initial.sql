begin;

create extension if not exists pgcrypto with schema extensions;

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 100),
  description text not null default '' check (length(description) <= 1000),
  emoji text not null default '🌿' check (length(emoji) between 1 and 16),
  visibility text not null default 'private' check (visibility in ('private', 'link', 'public')),
  share_token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);
create index wishlists_owner_id_idx on public.wishlists(owner_id);

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  url text not null check (length(url) <= 2000 and url ~ '^https?://[^[:space:]]+$'),
  notes text not null default '' check (length(notes) <= 3000),
  image_url text not null default '' check (length(image_url) <= 2000 and (image_url = '' or image_url ~ '^https?://[^[:space:]]+$')),
  price numeric(8,2) check (price between 0 and 999999.99),
  fulfilled boolean not null default false,
  created_at timestamptz not null default now()
);
create index wishes_wishlist_id_idx on public.wishes(wishlist_id);

alter table public.wishlists enable row level security;
alter table public.wishes enable row level security;

create policy "Owner reads lists" on public.wishlists for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "Public lists are readable" on public.wishlists for select to anon, authenticated
  using (visibility = 'public');
create policy "Owner creates lists" on public.wishlists for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Owner updates lists" on public.wishlists for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owner deletes lists" on public.wishlists for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "Visible list items are readable" on public.wishes for select to anon, authenticated
  using (exists (select 1 from public.wishlists l where l.id = wishlist_id and (l.owner_id = (select auth.uid()) or l.visibility = 'public')));
create policy "Owner creates items" on public.wishes for insert to authenticated
  with check (exists (select 1 from public.wishlists l where l.id = wishlist_id and l.owner_id = (select auth.uid())));
create policy "Owner updates items" on public.wishes for update to authenticated
  using (exists (select 1 from public.wishlists l where l.id = wishlist_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.wishlists l where l.id = wishlist_id and l.owner_id = (select auth.uid())));
create policy "Owner deletes items" on public.wishes for delete to authenticated
  using (exists (select 1 from public.wishlists l where l.id = wishlist_id and l.owner_id = (select auth.uid())));

-- A transition to/from private or public revokes any previous unlisted link.
create function public.invalidate_share_link() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.visibility is distinct from old.visibility then
    new.share_token := encode(extensions.gen_random_bytes(32), 'hex');
  end if;
  return new;
end;
$$;
create trigger invalidate_share_link before update on public.wishlists
  for each row execute function public.invalidate_share_link();

-- Guests cannot enumerate unlisted lists through table queries. The token must
-- be presented to this deliberately narrow read-only function.
create function public.get_shared_wishlist(token text) returns jsonb
  language sql stable security definer set search_path = '' as $$
    select jsonb_build_object(
      'list', to_jsonb(l) - 'owner_id' - 'share_token',
      'items', coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at) from public.wishes w where w.wishlist_id = l.id), '[]'::jsonb)
    )
    from public.wishlists l
    where l.share_token = token and l.visibility = 'link' and length(token) = 64;
$$;
revoke all on function public.get_shared_wishlist(text) from public;
grant execute on function public.get_shared_wishlist(text) to anon, authenticated;

create function public.rotate_share_token(list_id uuid) returns text
  language plpgsql security invoker set search_path = '' as $$
declare new_token text;
begin
  update public.wishlists set share_token = encode(extensions.gen_random_bytes(32), 'hex')
    where id = list_id and owner_id = (select auth.uid()) and visibility = 'link'
    returning share_token into new_token;
  if new_token is null then raise exception 'List unavailable'; end if;
  return new_token;
end;
$$;
revoke all on function public.rotate_share_token(uuid) from public;
grant execute on function public.rotate_share_token(uuid) to authenticated;

-- An authenticated per-user budget protects the free preview-function quota.
create table public.preview_budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  uses integer not null default 0,
  primary key (user_id, day)
);
alter table public.preview_budgets enable row level security;
revoke all on public.preview_budgets from anon, authenticated;

create function public.consume_preview_budget() returns boolean
  language plpgsql security definer set search_path = '' as $$
declare current_uses integer;
begin
  if (select auth.uid()) is null then return false; end if;
  insert into public.preview_budgets (user_id, day, uses) values ((select auth.uid()), current_date, 1)
    on conflict (user_id, day) do update set uses = public.preview_budgets.uses + 1
      where public.preview_budgets.uses < 40
    returning uses into current_uses;
  return current_uses is not null;
end;
$$;
revoke all on function public.consume_preview_budget() from public;
grant execute on function public.consume_preview_budget() to authenticated;

grant select on public.wishlists, public.wishes to anon;
grant select, insert, update, delete on public.wishlists, public.wishes to authenticated;

commit;
