import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const db = new PGlite({ extensions: { pgcrypto } })
const owner = '00000000-0000-4000-8000-000000000011', guest = '00000000-0000-4000-8000-000000000012'
const proof = 'a'.repeat(64), otherProof = 'b'.repeat(64)
async function role(user?: string) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || ''])
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`)
}
async function fixture(visibility = 'link') {
  await role(owner)
  const list = (await db.query<{ id: string; share_token: string }>("insert into public.wishlists(owner_id,title,visibility) values($1,'Gift fixture',$2) returning id,share_token", [owner, visibility])).rows[0]
  const wish = (await db.query<{ id: string }>("insert into public.wishes(wishlist_id,title,url) values($1,'A gift','https://example.com/gift') returning id", [list.id])).rows[0]
  return { list, wish }
}
async function buy(list: { id: string; share_token: string }, item: { id: string }, receipt = proof, token: string | null = list.share_token) {
  return (await db.query<{ value: string }>('select public.purchase_wish($1,$2,$3,$4) as value', [list.id, item.id, token, receipt])).rows[0].value
}
async function payload(token: string) { return (await db.query<{ value: { can_purchase: boolean; items: Record<string, unknown>[] } }>('select public.get_shared_wishlist($1) as value', [token])).rows[0].value }

before(async () => {
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create schema extensions;
    grant usage on schema public,auth,extensions to anon,authenticated;
    alter default privileges in schema public grant all on tables to anon,authenticated;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
    insert into auth.users(id) values('${owner}'),('${guest}');`)
  const root = new URL('../supabase/migrations/', import.meta.url)
  for (const name of (await readdir(root)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, root), 'utf8'))
})
after(async () => db.close())

test('anonymous purchase is visible to other guests and hidden in all authenticated owner reads', async () => {
  const { list, wish } = await fixture()
  await role()
  assert.equal(await buy(list, wish), 'purchased')
  assert.equal((await payload(list.share_token)).items[0].purchased, true)
  await role(guest)
  assert.equal((await payload(list.share_token)).items[0].purchased, true)
  await role(owner)
  const hidden = await payload(list.share_token)
  assert.equal(hidden.can_purchase, false)
  assert.equal('purchased' in hidden.items[0], false)
  const ownWish = (await db.query<Record<string, unknown>>('select * from public.wishes where id=$1', [wish.id])).rows[0]
  assert.equal(ownWish.fulfilled, false)
  assert.equal('purchased' in ownWish, false)
  for (const query of ['select * from public.wish_purchases', 'select public.gift_access($1,$2)']) await assert.rejects(db.query(query, query.includes('$1') ? [list.id, list.share_token] : []), /permission denied/)
  await assert.rejects(buy(list, wish), /nicht verfügbar/)
  await assert.rejects(db.query('select public.undo_wish_purchase($1,$2,$3,$4)', [list.id, wish.id, list.share_token, proof]), /nicht verfügbar/)
})

test('private, mismatched and revoked links cannot write purchases; trigger/helper/table access stays closed', async () => {
  const a = await fixture(), b = await fixture(), privateList = await fixture('private')
  await role()
  await assert.rejects(buy(a.list, a.wish, proof, b.list.share_token), /nicht verfügbar/)
  await assert.rejects(buy(privateList.list, privateList.wish), /nicht verfügbar/)
  await assert.rejects(buy(a.list, b.wish), /nicht mehr/)
  await assert.rejects(buy(a.list, a.wish, 'short'), /nicht verfügbar/)
  await assert.rejects(db.exec('select * from public.wish_purchases'), /permission denied/)
  await assert.rejects(db.query('select public.gift_access($1,$2)', [a.list.id, a.list.share_token]), /permission denied/)
  assert.equal((await db.query<{ yes: boolean }>("select has_table_privilege('anon','public.wish_purchases','TRUNCATE,SELECT,INSERT,UPDATE,DELETE,TRIGGER') as yes")).rows[0].yes, false)
  await role(owner)
  await db.query('select public.rotate_share_token($1)', [a.list.id])
  await role()
  await assert.rejects(buy(a.list, a.wish), /nicht verfügbar/)
})

test('retries are idempotent, a second buyer cannot overwrite, and only the matching receipt can undo', async () => {
  const { list, wish } = await fixture()
  await role()
  assert.equal(await buy(list, wish), 'purchased')
  assert.equal(await buy(list, wish), 'purchased')
  assert.equal(await buy(list, wish, otherProof), 'already_purchased')
  assert.equal((await db.query<{ yes: boolean }>('select public.undo_wish_purchase($1,$2,$3,$4) as yes', [list.id, wish.id, list.share_token, otherProof])).rows[0].yes, false)
  assert.equal((await payload(list.share_token)).items[0].purchased, true)
  assert.equal((await db.query<{ yes: boolean }>('select public.undo_wish_purchase($1,$2,$3,$4) as yes', [list.id, wish.id, list.share_token, proof])).rows[0].yes, true)
  assert.equal((await payload(list.share_token)).items[0].purchased, false)
  assert.equal(await buy(list, wish, otherProof), 'purchased')
})

test('public links work without tokens, owner remains unaware and received/replaced wishes reset coordination', async () => {
  const { list, wish } = await fixture('public')
  await role()
  assert.equal(await buy(list, wish, proof, null), 'purchased')
  const publicPayload = async () => (await db.query<{ value: { items: Record<string, unknown>[] } }>('select public.get_public_wishlist($1) as value', [list.id])).rows[0].value
  assert.equal((await publicPayload()).items[0].purchased, true)
  await role(owner)
  assert.equal('purchased' in (await publicPayload()).items[0], false)
  await db.query("update public.wishes set notes='Changed note' where id=$1", [wish.id])
  await role()
  assert.equal((await publicPayload()).items[0].purchased, true)
  await role(owner)
  await db.query('update public.wishes set fulfilled=true where id=$1', [wish.id])
  await role()
  await assert.rejects(buy(list, wish, proof, null), /nicht mehr/)
  assert.equal((await publicPayload()).items[0].purchased, false)
  await role(owner)
  await db.query('update public.wishes set fulfilled=false where id=$1', [wish.id])
  await role()
  assert.equal(await buy(list, wish, proof, null), 'purchased')
  await role(owner)
  await db.query("update public.wishes set url='https://example.com/another-product' where id=$1", [wish.id])
  await role()
  assert.equal((await publicPayload()).items[0].purchased, false)
})

test('highlights are shared read-only, editable by members, and independent of hidden purchase marks', async () => {
  const { list, wish } = await fixture()
  assert.equal((await db.query<{ highlighted: boolean }>('select highlighted from public.wishes where id=$1', [wish.id])).rows[0].highlighted, false)
  await db.query('update public.wishes set highlighted=true where id=$1', [wish.id])
  await role(guest)
  assert.deepEqual((await db.query('update public.wishes set highlighted=false where id=$1 returning id', [wish.id])).rows, [])
  await role()
  assert.equal((await payload(list.share_token)).items[0].highlighted, true)
  await assert.rejects(db.query('update public.wishes set highlighted=false where id=$1', [wish.id]), /permission denied/)
  await assert.rejects(db.query('select public.read_wishlist_payload($1)', [list.id]), /permission denied/)
  assert.equal(await buy(list, wish), 'purchased')
  await role(owner)
  const own = await payload(list.share_token)
  assert.equal(own.items[0].highlighted, true); assert.equal('purchased' in own.items[0], false)
  await db.query('select public.create_wishlist_invite($1)', [list.id])
  const invitation = (await db.query<{ data: { invite: { token: string } } }>('select public.get_collaboration($1) as data', [list.id])).rows[0].data.invite.token
  await role(guest)
  await db.query('select public.accept_wishlist_invite($1)', [invitation])
  assert.equal((await db.query<{ highlighted: boolean }>('update public.wishes set highlighted=false where id=$1 returning highlighted', [wish.id])).rows[0].highlighted, false)
  assert.equal((await payload(list.share_token)).items[0].purchased, true)
  await role(owner)
  await db.query("update public.wishlists set visibility='public' where id=$1", [list.id])
  await db.query('update public.wishes set highlighted=true where id=$1', [wish.id])
  await assert.rejects(db.query('update public.wishes set highlighted=null where id=$1', [wish.id]), /not-null constraint/)
  await role()
  const shared = (await db.query<{ data: { list: Record<string, unknown>; items: Record<string, unknown>[] } }>('select public.get_public_wishlist($1) as data', [list.id])).rows[0].data
  assert.equal(shared.items[0].highlighted, true)
  assert.equal('owner_id' in shared.list, false); assert.equal('share_token' in shared.list, false)
  assert.equal('receipt_hash' in shared.items[0], false)
  await role(owner)
  await db.query("update public.wishlists set visibility='private' where id=$1", [list.id])
  await role()
  assert.equal((await db.query<{ data: unknown }>('select public.get_public_wishlist($1) as data', [list.id])).rows[0].data, null)
})
