import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

// Executes the actual migration in PostgreSQL/WASM. Only the Supabase auth
// schema and roles are fixtures; policies and RPCs are the production source.
const db = new PGlite({ extensions: { pgcrypto } })
const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
let privateId: string, linkId: string, publicId: string, bobListId: string, itemId: string, token: string

async function role(user?: string) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user || ''])
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`)
}
async function count(table: string): Promise<number> { return Number((await db.query<{ n: number }>(`select count(*) as n from public.${table}`)).rows[0].n) }

before(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create schema extensions;
    grant usage on schema public, auth, extensions to anon, authenticated;
    -- Reproduce the broad platform table defaults observed in production.
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    insert into auth.users(id) values ('${alice}'), ('${bob}');
    update auth.users set email='alice@example.invalid',email_confirmed_at=now() where id='${alice}';
    update auth.users set email='bob@example.invalid',email_confirmed_at=now() where id='${bob}';
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/202611070001_initial.sql', import.meta.url), 'utf8'))
  await role(alice)
  const created = await db.query<{ id: string; share_token: string }>("insert into public.wishlists(owner_id,title,visibility) values ($1,'Private','private'),($1,'Link','link'),($1,'Public','public') returning id,share_token", [alice])
  ;[privateId, linkId, publicId] = created.rows.map(row => row.id)
  token = created.rows[1].share_token
  const wishes = await db.query<{ id: string }>("insert into public.wishes(wishlist_id,title,url) values ($1,'Private item','https://shop.de/1'),($2,'Link item','https://shop.de/2'),($3,'Public item','https://shop.de/3') returning id", [privateId, linkId, publicId])
  itemId = wishes.rows[0].id
  await role(bob)
  bobListId = (await db.query<{ id: string }>("insert into public.wishlists(owner_id,title) values ($1,'Bob') returning id", [bob])).rows[0].id
  await db.exec('reset role')
  await db.exec(await readFile(new URL('../supabase/migrations/202611090001_offer_search.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/202611090002_collaboration.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/202611090003_public_projection.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../supabase/migrations/202611090004_security_hardening.sql', import.meta.url), 'utf8'))
})

test('browser roles have no whole-table operations or mutable security columns', async () => {
  for (const user of [undefined, alice]) {
    await role(user)
    for (const table of ['wishlists', 'wishes']) {
      assert.equal((await db.query<{ allowed: boolean }>("select has_table_privilege(current_user,$1,'TRUNCATE,TRIGGER,REFERENCES') as allowed", ['public.' + table])).rows[0].allowed, false)
      await assert.rejects(db.exec(`truncate public.${table}`), /permission denied/)
    }
    await assert.rejects(db.query('select public.read_wishlist_payload($1)', [publicId]), /permission denied/)
  }
  await role(alice)
  for (const column of ['owner_id', 'share_token', 'id', 'created_at']) assert.equal((await db.query<{ allowed: boolean }>("select has_column_privilege(current_user,'public.wishlists',$1,'UPDATE') as allowed", [column])).rows[0].allowed, false)
  for (const column of ['id', 'wishlist_id', 'created_at']) assert.equal((await db.query<{ allowed: boolean }>("select has_column_privilege(current_user,'public.wishes',$1,'UPDATE') as allowed", [column])).rows[0].allowed, false)
  await assert.rejects(db.query("insert into public.wishlists(owner_id,title,share_token) values($1,'Weak token','guessable')", [alice]), /permission denied/)
  await db.exec('reset role')
  await db.exec('create table public.future_private_fixture(id integer); create function public.future_private_function() returns integer language sql as $$ select 1 $$')
  await role(alice)
  await assert.rejects(db.exec('select * from public.future_private_fixture'), /permission denied/)
  await assert.rejects(db.exec('select public.future_private_function()'), /permission denied/)
  await db.exec('reset role; drop table public.future_private_fixture; drop function public.future_private_function()')
})

test('member metadata cannot spoof owner access or the verified account email', async () => {
  await role(alice)
  const listId = (await db.query<{ id: string }>("insert into public.wishlists(owner_id,title) values($1,'Identity check') returning id", [alice])).rows[0].id
  await db.query('select public.create_wishlist_invite($1)', [listId])
  const token = (await db.query<{ data: { invite: { token: string } } }>('select public.get_collaboration($1) as data', [listId])).rows[0].data.invite.token
  await role(bob)
  await db.exec(`select set_config('request.jwt.claims','{"user_metadata":{"full_name":"Alice Besitzerin","email":"alice@example.invalid","role":"service_role","is_admin":true}}',false)`)
  await db.query('select public.accept_wishlist_invite($1)', [token])
  await assert.rejects(db.query('select public.get_collaboration($1)', [listId]), /Nur der Besitzer/)
  await role(alice)
  const member = (await db.query<{ data: { members: { display_name: string; email: string }[] } }>('select public.get_collaboration($1) as data', [listId])).rows[0].data.members[0]
  assert.equal(member.display_name, 'Alice Besitzerin') // Cosmetic, user-editable.
  assert.equal(member.email, 'bob@example.invalid') // Verified auth record, not metadata.
  await db.query('delete from public.wishlists where id=$1', [listId])
})

test('membership cap rejects additional invite joins while existing members keep access', async () => {
  await role(alice)
  const listId = (await db.query<{ id: string }>("insert into public.wishlists(owner_id,title) values($1,'Member quota') returning id", [alice])).rows[0].id
  await db.query('select public.create_wishlist_invite($1)', [listId])
  const invite = (await db.query<{ data: { invite: { token: string } } }>('select public.get_collaboration($1) as data', [listId])).rows[0].data.invite.token
  await role()
  await db.exec('reset role')
  const users = (await db.query<{ id: string }>('insert into auth.users(id) select gen_random_uuid() from generate_series(1,100) returning id')).rows.map(row => row.id)
  await db.query("insert into public.wishlist_members(wishlist_id,user_id,display_name) select $1,id,'Quota member' from auth.users where id=any($2::uuid[])", [listId, users])
  await role(bob)
  await assert.rejects(db.query('select public.accept_wishlist_invite($1)', [invite]), /100 Mitbearbeiter/)
  await role(users[0])
  assert.equal((await db.query<{ id: string }>('select public.accept_wishlist_invite($1) as id', [invite])).rows[0].id, listId)
  await role(alice)
  await db.query('delete from public.wishlists where id=$1', [listId])
  await role()
  await db.exec('reset role')
  await db.query('delete from auth.users where id=any($1::uuid[])', [users])
})

test('creation limits apply to direct API-style writes while editing/deleting remains possible', async () => {
  await role()
  await db.exec('reset role')
  const userId = (await db.query<{ id: string }>('insert into auth.users(id) values(gen_random_uuid()) returning id')).rows[0].id
  const lists = (await db.query<{ id: string }>("insert into public.wishlists(owner_id,title) select $1,'Quota '||n from generate_series(1,50)n returning id", [userId])).rows
  await db.query("insert into public.wishes(wishlist_id,title,url) select $1,'Quota wish '||n,'https://shop.de/item' from generate_series(1,500)n", [lists[0].id])
  await role(userId)
  await assert.rejects(db.query("insert into public.wishlists(owner_id,title) values($1,'Over limit')", [userId]), /50 Wunschlisten/)
  await assert.rejects(db.query("insert into public.wishes(wishlist_id,title,url) values($1,'Over limit','https://shop.de/item')", [lists[0].id]), /500 Wünsche/)
  await db.exec('reset role')
  await db.query('insert into public.creation_budgets(user_id,day,uses) values($1,current_date,500)', [userId])
  await role(userId)
  await assert.rejects(db.query("insert into public.wishes(wishlist_id,title,url) values($1,'Daily limit','https://shop.de/item')", [lists[1].id]), /Heute wurden bereits 500/)
  await db.query("update public.wishes set notes='Still editable' where wishlist_id=$1", [lists[0].id])
  await db.query('delete from public.wishes where wishlist_id=$1', [lists[0].id])
  await assert.rejects(db.query('select * from public.creation_budgets'), /permission denied/)
  await db.exec('reset role')
  await db.query('delete from auth.users where id=$1', [userId])
})
after(async () => { await db.close() })

test('existing wishes receive offer-search defaults and only owners can change them', async () => {
  await role(alice)
  const row = (await db.query<{ offer_source: string; search_term: string; search_url: string }>('select offer_source,search_term,search_url from public.wishes where id=$1', [itemId])).rows[0]
  assert.deepEqual(row, { offer_source: 'idealo', search_term: '', search_url: '' })
  await db.query("update public.wishes set offer_source='ebay', search_term='Genaues Modell' where id=$1", [itemId])
  await role(bob)
  await db.query("update public.wishes set offer_source='custom',search_url='https://attacker.com/' where id=$1", [itemId])
  await role(alice)
  assert.equal((await db.query<{ offer_source: string }>('select offer_source from public.wishes where id=$1', [itemId])).rows[0].offer_source, 'ebay')
  await assert.rejects(db.query("update public.wishes set offer_source='custom',search_url='' where id=$1", [itemId]), /check constraint/)
  await assert.rejects(db.query("update public.wishes set offer_source='custom',search_url='javascript:alert(1)' where id=$1", [itemId]), /check constraint/)
})

test('owner can read all their lists and items', async () => {
  await role(alice)
  assert.equal(await count('wishlists'), 3)
  assert.equal(await count('wishes'), 3)
})
test('shared guests receive the offer-search settings without gaining write access', async () => {
  await role(alice)
  await db.query("update public.wishes set offer_source='kleinanzeigen',search_term='Modell X123' where wishlist_id=$1", [linkId])
  await role()
  const shared = (await db.query<{ data: { items: { offer_source: string; search_term: string }[] } }>('select public.get_shared_wishlist($1) as data', [token])).rows[0].data
  assert.equal(shared.items[0].offer_source, 'kleinanzeigen')
  assert.equal(shared.items[0].search_term, 'Modell X123')
  await assert.rejects(db.query("update public.wishes set search_term='Changed' where wishlist_id=$1", [linkId]), /permission denied/)
})
test('anonymous users read public lists only through a safe RPC projection', async () => {
  await role()
  await assert.rejects(count('wishlists'), /permission denied/)
  await assert.rejects(count('wishes'), /permission denied/)
  const result = (await db.query<{ data: { list: Record<string, unknown>; items: unknown[] } }>('select public.get_public_wishlist($1) as data', [publicId])).rows[0].data
  assert.equal(result.list.title, 'Public')
  assert.equal(result.items.length, 1)
  assert.equal('owner_id' in result.list, false)
  assert.equal('share_token' in result.list, false)
  assert.equal((await db.query<{ data: unknown }>('select public.get_public_wishlist($1) as data', [linkId])).rows[0].data, null)
})
test('a second user cannot read, change or delete private or unlisted data', async () => {
  await role(bob)
  assert.equal(await count('wishlists'), 1) // Bob's own list; public projection uses RPC.
  assert.equal(await count('wishes'), 0)
  assert.equal((await db.query("update public.wishes set title='Stolen' where id=$1 returning id", [itemId])).rows.length, 0)
  assert.equal((await db.query('delete from public.wishlists where id=$1 returning id', [privateId])).rows.length, 0)
  await assert.rejects(db.query("insert into public.wishes(wishlist_id,title,url) values ($1,'Bad','https://shop.de')", [linkId]), /row-level security/)
  await assert.rejects(db.query("insert into public.wishlists(owner_id,title) values ($1,'Bad')", [alice]), /row-level security/)
})
test('owners cannot transfer their lists or move items into another user’s list', async () => {
  await role(alice)
  await assert.rejects(db.query('update public.wishlists set owner_id=$1 where id=$2', [bob, privateId]), /permission denied/)
  await assert.rejects(db.query('update public.wishes set wishlist_id=$1 where id=$2', [bobListId, itemId]), /permission denied/)
})
test('secret RPC reveals only a matching unlisted list and no owner or secret field', async () => {
  await role()
  const result = (await db.query<{ value: { list: Record<string, unknown>; items: unknown[] } }>('select public.get_shared_wishlist($1) as value', [token])).rows[0].value
  assert.equal(result.list.title, 'Link')
  assert.equal(result.items.length, 1)
  assert.equal('owner_id' in result.list, false)
  assert.equal('share_token' in result.list, false)
  assert.equal((await db.query<{ value: unknown }>('select public.get_shared_wishlist($1) as value', ['b'.repeat(64)])).rows[0].value, null)
})
test('only the owner can rotate a secret, and the old token immediately stops working', async () => {
  await role(bob)
  await assert.rejects(db.query('select public.rotate_share_token($1)', [linkId]), /List unavailable/)
  await role(alice)
  const rotated = (await db.query<{ token: string }>('select public.rotate_share_token($1) as token', [linkId])).rows[0].token
  assert.notEqual(rotated, token)
  assert.equal(rotated.length, 64)
  await role()
  assert.equal((await db.query<{ value: unknown }>('select public.get_shared_wishlist($1) as value', [token])).rows[0].value, null)
  token = rotated
})
test('making a list private revokes the link permanently, including after re-sharing', async () => {
  await role(alice)
  await db.query("update public.wishlists set visibility='private' where id=$1", [linkId])
  await role()
  assert.equal((await db.query<{ value: unknown }>('select public.get_shared_wishlist($1) as value', [token])).rows[0].value, null)
  await role(alice)
  await db.query("update public.wishlists set visibility='link' where id=$1", [linkId])
  await role()
  assert.equal((await db.query<{ value: unknown }>('select public.get_shared_wishlist($1) as value', [token])).rows[0].value, null)
})
test('preview budget is isolated per user and capped at 40 calls per day', async () => {
  await role(alice)
  for (let i = 0; i < 40; i++) assert.equal((await db.query<{ ok: boolean }>('select public.consume_preview_budget() as ok')).rows[0].ok, true)
  assert.equal((await db.query<{ ok: boolean }>('select public.consume_preview_budget() as ok')).rows[0].ok, false)
  await assert.rejects(db.query('select * from public.preview_budgets'), /permission denied/)
  await role(bob)
  assert.equal((await db.query<{ ok: boolean }>('select public.consume_preview_budget() as ok')).rows[0].ok, true)
  await role()
  await assert.rejects(db.query('select public.consume_preview_budget()'), /permission denied/)
})
test('deleting a list also deletes its items', async () => {
  await role(alice)
  await db.query('delete from public.wishlists where id=$1', [privateId])
  assert.equal((await db.query('select id from public.wishes where id=$1', [itemId])).rows.length, 0)
})

test('invitation acceptance grants wish editing while list administration stays with the owner', async () => {
  await role(alice)
  const list = (await db.query<{ id: string; share_token: string }>("insert into public.wishlists(owner_id,title) values ($1,'Together') returning id,share_token", [alice])).rows[0]
  await db.query('select public.create_wishlist_invite($1)', [list.id])
  const state = (await db.query<{ data: { invite: { token: string }; members: unknown[] } }>('select public.get_collaboration($1) as data', [list.id])).rows[0].data
  const invite = state.invite.token
  assert.match(invite, /^[a-f0-9]{64}$/)
  assert.notEqual(invite, list.share_token)
  await role()
  const preview = (await db.query<{ data: Record<string, unknown> }>('select public.get_wishlist_invite($1) as data', [invite])).rows[0].data
  assert.deepEqual(Object.keys(preview).sort(), ['already_joined', 'emoji', 'expires_at', 'title'])
  assert.equal(preview.already_joined, false)
  await assert.rejects(db.query('select public.accept_wishlist_invite($1)', [invite]), /permission denied/)
  await assert.rejects(db.query('select * from public.wishlist_invites'), /permission denied/)
  await role(bob)
  assert.equal((await db.query('select id from public.wishlists where id=$1', [list.id])).rows.length, 0)
  const beforeLists = (await db.query<{ id: string }>('select id from public.get_my_wishlists()')).rows
  assert.deepEqual(beforeLists.map(l => l.id), [bobListId]) // Excludes Alice's readable public list.
  await assert.rejects(db.query('select public.get_collaboration($1)', [list.id]), /Nur der Besitzer/)
  await assert.rejects(db.query('select public.create_wishlist_invite($1)', [list.id]), /Nur der Besitzer/)
  await assert.rejects(db.query('select public.accept_wishlist_invite($1)', ['f'.repeat(64)]), /abgelaufen/)
  await db.exec(`select set_config('request.jwt.claims', '{"user_metadata":{"full_name":"Bob Beispiel"}}', false)`)
  assert.equal((await db.query<{ id: string }>('select public.accept_wishlist_invite($1) as id', [invite])).rows[0].id, list.id)
  await db.query('select public.accept_wishlist_invite($1)', [invite]) // Idempotent.
  assert.equal((await db.query('select id from public.get_my_wishlists() where id=$1', [list.id])).rows.length, 1)
  const wish = (await db.query<{ id: string }>("insert into public.wishes(wishlist_id,title,url) values ($1,'Shared wish','https://example.com/item') returning id", [list.id])).rows[0]
  assert.equal((await db.query("update public.wishes set title='Edited together',fulfilled=true where id=$1 returning id", [wish.id])).rows.length, 1)
  await assert.rejects(db.query('update public.wishes set wishlist_id=$1 where id=$2', [linkId, wish.id]), /permission denied/)
  assert.equal((await db.query("update public.wishlists set visibility='public',title='Hijacked' where id=$1 returning id", [list.id])).rows.length, 0)
  assert.equal((await db.query('delete from public.wishlists where id=$1 returning id', [list.id])).rows.length, 0)
  for (const fn of ['create_wishlist_invite', 'revoke_wishlist_invite', 'get_collaboration', 'rotate_share_token']) {
    await assert.rejects(db.query(`select public.${fn}($1)`, [list.id]), /Nur der Besitzer|List unavailable/)
  }
  await assert.rejects(db.query('select public.remove_wishlist_member($1,$2)', [list.id, alice]), /Nur der Besitzer/)
  await assert.rejects(db.query('insert into public.wishlist_members(wishlist_id,user_id) values ($1,$2)', [linkId, bob]), /permission denied/)
  await role(alice)
  const members = (await db.query<{ data: { members: { display_name: string }[] } }>('select public.get_collaboration($1) as data', [list.id])).rows[0].data.members
  assert.equal(members.length, 1)
  assert.equal(members[0].display_name, 'Bob Beispiel')
  assert.equal((await db.query<{ title: string }>('select title from public.wishes where id=$1', [wish.id])).rows[0].title, 'Edited together')
  await db.query('select public.revoke_wishlist_invite($1)', [list.id])
  await role(bob)
  assert.equal((await db.query('select id from public.wishes where id=$1', [wish.id])).rows.length, 1) // Revocation only blocks future joins.
  await assert.rejects(db.query('select public.accept_wishlist_invite($1)', [invite]), /abgelaufen/)
  await db.query('delete from public.wishes where id=$1', [wish.id])
  await role(alice)
  await db.query('select public.create_wishlist_invite($1)', [list.id])
  const renewed = (await db.query<{ data: { invite: { token: string } } }>('select public.get_collaboration($1) as data', [list.id])).rows[0].data.invite.token
  await db.query('select public.remove_wishlist_member($1,$2)', [list.id, bob])
  await role(bob)
  assert.equal((await db.query('select id from public.get_my_wishlists() where id=$1', [list.id])).rows.length, 0)
  assert.equal((await db.query('select id from public.wishlists where id=$1', [list.id])).rows.length, 0)
  await assert.rejects(db.query("insert into public.wishes(wishlist_id,title,url) values ($1,'No access','https://example.com')", [list.id]), /row-level security/)
  await assert.rejects(db.query('select public.accept_wishlist_invite($1)', [renewed]), /abgelaufen/)
  await role(alice)
  await db.query('delete from public.wishlists where id=$1', [list.id])
})

test('expired invitations grant no access, leaving preserves content, deletion cascades membership', async () => {
  await role(alice)
  const listId = (await db.query<{ id: string }>("insert into public.wishlists(owner_id,title) values ($1,'Temporary') returning id", [alice])).rows[0].id
  await db.query('select public.create_wishlist_invite($1)', [listId])
  let invite = (await db.query<{ data: { invite: { token: string } } }>('select public.get_collaboration($1) as data', [listId])).rows[0].data.invite.token
  await db.exec('reset role')
  await db.query("update public.wishlist_invites set expires_at=now()-interval '1 second' where wishlist_id=$1", [listId])
  await role(bob)
  assert.equal((await db.query<{ data: unknown }>('select public.get_wishlist_invite($1) as data', [invite])).rows[0].data, null)
  await assert.rejects(db.query('select public.accept_wishlist_invite($1)', [invite]), /abgelaufen/)
  await role(alice)
  await db.query('select public.create_wishlist_invite($1)', [listId])
  invite = (await db.query<{ data: { invite: { token: string } } }>('select public.get_collaboration($1) as data', [listId])).rows[0].data.invite.token
  await role(bob)
  await db.query('select public.accept_wishlist_invite($1)', [invite])
  await db.query("insert into public.wishes(wishlist_id,title,url) values ($1,'Keep me','https://example.com')", [listId])
  await db.query('select public.leave_wishlist($1)', [listId])
  assert.equal((await db.query('select id from public.wishlists where id=$1', [listId])).rows.length, 0)
  await db.query('select public.accept_wishlist_invite($1)', [invite])
  await role(alice)
  assert.equal((await db.query('select id from public.wishes where wishlist_id=$1', [listId])).rows.length, 1)
  await db.query('delete from public.wishlists where id=$1', [listId])
  await db.exec('reset role')
  assert.equal((await db.query('select * from public.wishlist_members where wishlist_id=$1', [listId])).rows.length, 0)
  assert.equal((await db.query('select * from public.wishlist_invites where wishlist_id=$1', [listId])).rows.length, 0)
})
