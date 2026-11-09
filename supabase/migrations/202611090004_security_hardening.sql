begin;

-- RLS does not protect whole-table operations such as TRUNCATE. Remove the
-- inherited platform defaults and grant only the API operations we use.
revoke all on public.wishlists, public.wishes, public.preview_budgets,
  public.wishlist_members, public.wishlist_invites from public, anon, authenticated;
grant select, delete on public.wishlists, public.wishes to authenticated;
grant insert (owner_id, title, description, emoji, visibility) on public.wishlists to authenticated;
grant update (title, description, emoji, visibility) on public.wishlists to authenticated;
grant insert (wishlist_id, title, url, notes, image_url, price, fulfilled, offer_source, search_term, search_url) on public.wishes to authenticated;
grant update (title, url, notes, image_url, price, fulfilled, offer_source, search_term, search_url) on public.wishes to authenticated;

-- New application migrations are owned by postgres. Future tables/functions
-- must explicitly opt into API access, including non-RLS table privileges.
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated;
revoke all on function public.invalidate_share_link() from public, anon, authenticated;
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

alter table public.wishlists add constraint wishlists_secure_share_token
  check (share_token ~ '^[a-f0-9]{64}$');

-- Opaque tokens and timestamps cannot be set by browser clients. Rotation is
-- deliberately owner-only and must run with the definer's column privilege.
create or replace function public.rotate_share_token(list_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare new_token text;
begin
  update public.wishlists set share_token = encode(extensions.gen_random_bytes(32), 'hex')
    where id = list_id and owner_id = (select auth.uid()) and visibility = 'link'
    returning share_token into new_token;
  if new_token is null then raise exception 'List unavailable'; end if;
  return new_token;
end;
$$;
revoke all on function public.rotate_share_token(uuid) from public, anon, authenticated;
grant execute on function public.rotate_share_token(uuid) to authenticated;

-- Public readers receive a safe projection through RPCs, never owner IDs or
-- share tokens from unrestricted table SELECTs. Existing share URLs still work.
drop policy "Public lists are readable" on public.wishlists;
drop policy "Visible list items are readable" on public.wishes;
create policy "Editors read items" on public.wishes for select to authenticated
  using (public.can_edit_wishlist(wishlist_id));
revoke all on function public.can_edit_wishlist(uuid) from public, anon;

-- Protect the small free database from unbounded bulk creation. All limits
-- are server-enforced and serialized, including concurrent API requests.
create table public.creation_budgets (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  uses integer not null check (uses between 1 and 500),
  primary key (user_id, day)
);
alter table public.creation_budgets enable row level security;
revoke all on public.creation_budgets from public, anon, authenticated;

create function public.enforce_creation_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid()); used integer;
begin
  -- Trusted maintenance/service-role jobs have no user JWT. Browser callers
  -- still need their column grants and RLS checks after this trigger.
  if caller is null then return new; end if;
  if tg_table_name = 'wishlists' then
    if new.owner_id <> caller then return new; end if;
  else
    if not public.can_edit_wishlist(new.wishlist_id) then return new; end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('creation-user:' || caller::text, 0));
  if tg_table_name = 'wishlists' then
    if (select count(*) from public.wishlists where owner_id = caller) >= 50 then
      raise exception 'Du kannst bis zu 50 Wunschlisten besitzen.' using errcode = '54000';
    end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('creation-list:' || new.wishlist_id::text, 0));
    if (select count(*) from public.wishes where wishlist_id = new.wishlist_id) >= 500 then
      raise exception 'Eine Wunschliste kann bis zu 500 Wünsche enthalten.' using errcode = '54000';
    end if;
  end if;
  insert into public.creation_budgets(user_id, day, uses) values (caller, current_date, 1)
    on conflict (user_id, day) do update set uses = public.creation_budgets.uses + 1
      where public.creation_budgets.uses < 500 returning uses into used;
  if used is null then raise exception 'Heute wurden bereits 500 Listen oder Wünsche angelegt. Morgen kannst du weitere ergänzen.' using errcode = '54000'; end if;
  return new;
end;
$$;
revoke all on function public.enforce_creation_limits() from public, anon, authenticated;
create trigger limit_list_creation before insert on public.wishlists for each row execute function public.enforce_creation_limits();
create trigger limit_wish_creation before insert on public.wishes for each row execute function public.enforce_creation_limits();

create or replace function public.accept_wishlist_invite(invite_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target_id uuid; member_name text;
begin
  if (select auth.uid()) is null then raise exception 'Bitte melde dich zuerst an.'; end if;
  select wishlist_id into target_id from public.wishlist_invites
    where token = invite_token and invite_token ~ '^[a-f0-9]{64}$' and expires_at > now() for update;
  if target_id is null then raise exception 'Diese Einladung ist abgelaufen oder wurde deaktiviert. Bitte frage nach einem neuen Link.'; end if;
  if public.can_edit_wishlist(target_id) then return target_id; end if;
  if (select count(*) from public.wishlist_members where wishlist_id = target_id) >= 100 then
    raise exception 'Diese Liste hat bereits 100 Mitbearbeiter.' using errcode = '54000';
  end if;
  member_name := coalesce(nullif(left(trim((select auth.jwt()) -> 'user_metadata' ->> 'full_name'), 100), ''), 'Mitglied');
  insert into public.wishlist_members(wishlist_id, user_id, display_name) values (target_id, (select auth.uid()), member_name)
    on conflict (wishlist_id, user_id) do nothing;
  return target_id;
end;
$$;
revoke all on function public.accept_wishlist_invite(text) from public, anon, authenticated;
grant execute on function public.accept_wishlist_invite(text) to authenticated;

-- User metadata names are editable. Only the owner sees a member's verified
-- account email, allowing them to distinguish namesakes or spoofed names.
create or replace function public.get_collaboration(list_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.wishlists where id = list_id and owner_id = (select auth.uid())) then
    raise exception 'Nur der Besitzer kann Einladungen und Mitglieder verwalten.';
  end if;
  return jsonb_build_object(
    'invite', (select jsonb_build_object('token', token, 'expires_at', expires_at) from public.wishlist_invites where wishlist_id = list_id and expires_at > now()),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id,
      'display_name', m.display_name, 'email', case when u.email_confirmed_at is not null then u.email else null end,
      'joined_at', m.joined_at) order by m.joined_at, m.user_id)
      from public.wishlist_members m join auth.users u on u.id = m.user_id where m.wishlist_id = list_id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_collaboration(uuid) from public, anon, authenticated;
grant execute on function public.get_collaboration(uuid) to authenticated;

commit;
