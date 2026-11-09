begin;

create table public.wishlist_members (
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Mitglied' check (length(display_name) between 1 and 100),
  joined_at timestamptz not null default now(),
  primary key (wishlist_id, user_id)
);
create index wishlist_members_user_idx on public.wishlist_members(user_id);
create table public.wishlist_invites (
  wishlist_id uuid primary key references public.wishlists(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  expires_at timestamptz not null default (now() + interval '7 days')
);
alter table public.wishlist_members enable row level security;
alter table public.wishlist_invites enable row level security;
-- No direct table access, including on projects that grant new tables by default.
revoke all on public.wishlist_members, public.wishlist_invites from public, anon, authenticated;

-- Definer helpers avoid recursive list/member policies. They only answer for
-- the calling user, never for an arbitrary supplied user ID.
create function public.can_edit_wishlist(list_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (
    exists (select 1 from public.wishlists where id = list_id and owner_id = (select auth.uid()))
    or exists (select 1 from public.wishlist_members where wishlist_id = list_id and user_id = (select auth.uid()))
  );
$$;
revoke all on function public.can_edit_wishlist(uuid) from public;
grant execute on function public.can_edit_wishlist(uuid) to anon, authenticated;

create policy "Members read lists" on public.wishlists for select to authenticated
  using (public.can_edit_wishlist(id));
drop policy "Visible list items are readable" on public.wishes;
drop policy "Owner creates items" on public.wishes;
drop policy "Owner updates items" on public.wishes;
drop policy "Owner deletes items" on public.wishes;
create policy "Visible list items are readable" on public.wishes for select to anon, authenticated
  using (public.can_edit_wishlist(wishlist_id) or exists (select 1 from public.wishlists l where l.id = wishlist_id and l.visibility = 'public'));
create policy "Editors create items" on public.wishes for insert to authenticated
  with check (public.can_edit_wishlist(wishlist_id));
create policy "Editors update items" on public.wishes for update to authenticated
  using (public.can_edit_wishlist(wishlist_id)) with check (public.can_edit_wishlist(wishlist_id));
create policy "Editors delete items" on public.wishes for delete to authenticated
  using (public.can_edit_wishlist(wishlist_id));

-- Return only owned/joined lists, not every readable public list.
create function public.get_my_wishlists() returns setof public.wishlists
language sql stable security definer set search_path = '' as $$
  select l.* from public.wishlists l where l.owner_id = (select auth.uid())
    or exists (select 1 from public.wishlist_members m where m.wishlist_id = l.id and m.user_id = (select auth.uid()))
  order by l.created_at, l.id;
$$;

create function public.get_collaboration(list_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.wishlists where id = list_id and owner_id = (select auth.uid())) then
    raise exception 'Nur der Besitzer kann Einladungen und Mitglieder verwalten.';
  end if;
  return jsonb_build_object(
    'invite', (select jsonb_build_object('token', token, 'expires_at', expires_at) from public.wishlist_invites where wishlist_id = list_id and expires_at > now()),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'display_name', display_name, 'joined_at', joined_at) order by joined_at, user_id) from public.wishlist_members where wishlist_id = list_id), '[]'::jsonb)
  );
end;
$$;

create function public.create_wishlist_invite(list_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.wishlists where id = list_id and owner_id = (select auth.uid())) then
    raise exception 'Nur der Besitzer kann Einladungen erstellen.';
  end if;
  insert into public.wishlist_invites(wishlist_id) values (list_id)
    on conflict (wishlist_id) do update set token = encode(extensions.gen_random_bytes(32), 'hex'), expires_at = now() + interval '7 days';
end;
$$;

create function public.revoke_wishlist_invite(list_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.wishlists where id = list_id and owner_id = (select auth.uid())) then
    raise exception 'Nur der Besitzer kann Einladungen deaktivieren.';
  end if;
  delete from public.wishlist_invites where wishlist_id = list_id;
end;
$$;

-- An invitation reveals only the list name before explicit acceptance.
create function public.get_wishlist_invite(invite_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('title', l.title, 'emoji', l.emoji, 'expires_at', i.expires_at,
    'already_joined', public.can_edit_wishlist(l.id))
  from public.wishlist_invites i join public.wishlists l on l.id = i.wishlist_id
  where i.token = invite_token and length(invite_token) = 64 and i.expires_at > now();
$$;

create function public.accept_wishlist_invite(invite_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target_id uuid; member_name text;
begin
  if (select auth.uid()) is null then raise exception 'Bitte melde dich zuerst an.'; end if;
  -- Serializes acceptance with revocation/rotation, including concurrent calls.
  select wishlist_id into target_id from public.wishlist_invites
    where token = invite_token and length(invite_token) = 64 and expires_at > now() for update;
  if target_id is null then raise exception 'Diese Einladung ist abgelaufen oder wurde deaktiviert. Bitte frage nach einem neuen Link.'; end if;
  if exists (select 1 from public.wishlists where id = target_id and owner_id = (select auth.uid())) then return target_id; end if;
  member_name := coalesce(nullif(left(trim((select auth.jwt()) -> 'user_metadata' ->> 'full_name'), 100), ''), 'Mitglied');
  insert into public.wishlist_members(wishlist_id, user_id, display_name) values (target_id, (select auth.uid()), member_name)
    on conflict (wishlist_id, user_id) do nothing;
  return target_id;
end;
$$;

create function public.remove_wishlist_member(list_id uuid, member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.wishlists where id = list_id and owner_id = (select auth.uid())) then
    raise exception 'Nur der Besitzer kann Mitglieder entfernen.';
  end if;
  -- Disable the invite first so a removed member cannot immediately rejoin.
  delete from public.wishlist_invites where wishlist_id = list_id;
  delete from public.wishlist_members where wishlist_id = list_id and user_id = member_id;
end;
$$;

create function public.leave_wishlist(list_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.wishlist_members where wishlist_id = list_id and user_id = (select auth.uid());
end;
$$;

revoke all on function public.get_my_wishlists(), public.get_collaboration(uuid), public.create_wishlist_invite(uuid), public.revoke_wishlist_invite(uuid), public.get_wishlist_invite(text), public.accept_wishlist_invite(text), public.remove_wishlist_member(uuid, uuid), public.leave_wishlist(uuid) from public, anon, authenticated;
grant execute on function public.get_wishlist_invite(text) to anon, authenticated;
grant execute on function public.get_my_wishlists(), public.get_collaboration(uuid), public.create_wishlist_invite(uuid), public.revoke_wishlist_invite(uuid), public.accept_wishlist_invite(text), public.remove_wishlist_member(uuid, uuid), public.leave_wishlist(uuid) to authenticated;

commit;
