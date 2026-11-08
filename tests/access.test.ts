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
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    insert into auth.users(id) values ('${alice}'), ('${bob}');
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
})
after(async () => { await db.close() })

test('owner can read all their lists and items', async () => {
  await role(alice)
  assert.equal(await count('wishlists'), 3)
  assert.equal(await count('wishes'), 3)
})
test('anonymous users see only public lists and their items', async () => {
  await role()
  assert.equal(await count('wishlists'), 1)
  assert.equal(await count('wishes'), 1)
  assert.equal((await db.query('select id from public.wishlists where id = $1', [linkId])).rows.length, 0)
})
test('a second user cannot read, change or delete private or unlisted data', async () => {
  await role(bob)
  assert.equal(await count('wishlists'), 2) // Bob's private + Alice's public
  assert.equal(await count('wishes'), 1)
  assert.equal((await db.query("update public.wishes set title='Stolen' where id=$1 returning id", [itemId])).rows.length, 0)
  assert.equal((await db.query('delete from public.wishlists where id=$1 returning id', [privateId])).rows.length, 0)
  await assert.rejects(db.query("insert into public.wishes(wishlist_id,title,url) values ($1,'Bad','https://shop.de')", [linkId]), /row-level security/)
  await assert.rejects(db.query("insert into public.wishlists(owner_id,title) values ($1,'Bad')", [alice]), /row-level security/)
})
test('owners cannot transfer their lists or move items into another user’s list', async () => {
  await role(alice)
  await assert.rejects(db.query('update public.wishlists set owner_id=$1 where id=$2', [bob, privateId]), /row-level security/)
  await assert.rejects(db.query('update public.wishes set wishlist_id=$1 where id=$2', [bobListId, itemId]), /row-level security/)
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
