begin;

-- Joined editors manage the same list, shares and members as its owner.
drop policy "Owner updates lists" on public.wishlists;
drop policy "Owner deletes lists" on public.wishlists;
create policy "Editors update lists" on public.wishlists for update to authenticated
  using (public.can_edit_wishlist(id)) with check (public.can_edit_wishlist(id));
create policy "Editors delete lists" on public.wishlists for delete to authenticated
  using (public.can_edit_wishlist(id));

create or replace function public.get_collaboration(list_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_edit_wishlist(list_id) then
    raise exception 'Nur Besitzer und Mitbearbeiter können diese Liste teilen.';
  end if;
  return jsonb_build_object(
    'owner', (select jsonb_build_object('user_id', u.id,
      'display_name', coalesce(nullif(left(trim(u.raw_user_meta_data ->> 'full_name'), 100), ''),
        nullif(left(trim(u.raw_user_meta_data ->> 'name'), 100), ''), 'Besitzer'),
      'email', case when u.email_confirmed_at is not null then u.email else null end)
      from public.wishlists l join auth.users u on u.id = l.owner_id where l.id = list_id),
    'invite', (select jsonb_build_object('token', token, 'expires_at', expires_at)
      from public.wishlist_invites where wishlist_id = list_id and expires_at > now()),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id,
        'display_name', m.display_name, 'email', case when u.email_confirmed_at is not null then u.email else null end,
        'joined_at', m.joined_at) order by m.joined_at, m.user_id)
        from public.wishlist_members m join auth.users u on u.id = m.user_id where m.wishlist_id = list_id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.revoke_wishlist_invite(list_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_edit_wishlist(list_id) then
    raise exception 'Nur Besitzer und Mitbearbeiter können diese Liste verwalten.';
  end if;
  delete from public.wishlist_invites where wishlist_id = list_id;
end;
$$;

create or replace function public.rotate_share_token(list_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare new_token text;
begin
  if not public.can_edit_wishlist(list_id) then raise exception 'List unavailable'; end if;
  update public.wishlists set share_token = encode(extensions.gen_random_bytes(32), 'hex')
    where id = list_id and visibility = 'link' returning share_token into new_token;
  if new_token is null then raise exception 'List unavailable'; end if;
  return new_token;
end;
$$;

create or replace function public.remove_wishlist_member(list_id uuid, member_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_edit_wishlist(list_id) then
    raise exception 'Nur Besitzer und Mitbearbeiter können diese Liste verwalten.';
  end if;
  if exists(select 1 from public.wishlists where id = list_id and owner_id = member_id) then
    raise exception 'Der Besitzer kann nicht aus der Liste entfernt werden.';
  end if;
  delete from public.wishlist_invites where wishlist_id = list_id;
  delete from public.wishlist_members where wishlist_id = list_id and user_id = member_id;
end;
$$;

create or replace function public.leave_wishlist(list_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.wishlists where id = list_id and owner_id = (select auth.uid())) then
    raise exception 'Der Besitzer kann nicht aus der Liste entfernt werden.';
  end if;
  delete from public.wishlist_members where wishlist_id = list_id and user_id = (select auth.uid());
end;
$$;

create or replace function public.create_wishlist_invite(list_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_edit_wishlist(list_id) then
    raise exception 'Nur Besitzer und Mitbearbeiter können diese Liste teilen.';
  end if;
  -- Reuse valid invitations so one person's share does not break another's.
  insert into public.wishlist_invites(wishlist_id) values (list_id)
    on conflict (wishlist_id) do update set token = encode(extensions.gen_random_bytes(32), 'hex'),
      expires_at = now() + interval '7 days'
    where public.wishlist_invites.expires_at <= now();
end;
$$;

-- Enable a read-only link by updating visibility alone, preserving concurrent
-- changes to the title, description and other list settings.
create function public.enable_wishlist_sharing(list_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_edit_wishlist(list_id) then
    raise exception 'Nur Besitzer und Mitbearbeiter können diese Liste teilen.';
  end if;
  update public.wishlists set visibility = 'link' where id = list_id and visibility = 'private';
end;
$$;

revoke all on function public.get_collaboration(uuid), public.create_wishlist_invite(uuid), public.enable_wishlist_sharing(uuid), public.revoke_wishlist_invite(uuid), public.rotate_share_token(uuid), public.remove_wishlist_member(uuid,uuid), public.leave_wishlist(uuid) from public, anon, authenticated;
grant execute on function public.get_collaboration(uuid), public.create_wishlist_invite(uuid), public.enable_wishlist_sharing(uuid), public.revoke_wishlist_invite(uuid), public.rotate_share_token(uuid), public.remove_wishlist_member(uuid,uuid), public.leave_wishlist(uuid) to authenticated;

commit;
