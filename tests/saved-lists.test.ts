import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { parseSavedLists, savedList, savedListUrl, writeSavedLists } from '../src/lib/savedLists.ts'

const owner = '00000000-0000-4000-8000-000000000021', guest = '00000000-0000-4000-8000-000000000022'
const db = new PGlite({ extensions: { pgcrypto } })
async function role(id?: string) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ''])
  await db.exec(`set role ${id ? 'authenticated' : 'anon'}`)
}
async function fixture(visibility = 'link') {
  await role(owner)
  return (await db.query<{ id: string; share_token: string }>("insert into public.wishlists(owner_id,title,visibility) values($1,'Geteilte Ideen',$2) returning id,share_token", [owner, visibility])).rows[0]
}
const bookmarks = async (id = guest) => (await db.query<{ value: Record<string, unknown>[] }>('select public.get_wishlist_bookmarks($1) as value', [id])).rows[0].value
const save = async (list: { share_token: string }, id = guest) => (await db.query<{ value: Record<string, unknown> }>("select public.save_wishlist_bookmark('token',$1,$2) as value", [list.share_token, id])).rows[0].value
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

test('device bookmarks validate references, deduplicate and never retain wish data', () => {
  const entry = savedList({ id: owner, title: 'Für Alex', emoji: '🎁' }, { kind: 'token', value: 'a'.repeat(64) })
  assert.equal(parseSavedLists(JSON.stringify([entry, entry])).length, 1)
  assert.deepEqual(parseSavedLists(JSON.stringify([{ ...entry, wishes: ['secret'], notes: 'secret', owner_id: guest, available: true }])), [entry])
  for (const value of [null, '{}', 'broken', JSON.stringify([{ ...entry, value: 'javascript:alert(1)' }]), JSON.stringify([{ ...entry, list_id: 'invalid' }])]) assert.deepEqual(parseSavedLists(value), [])
  assert.equal(savedListUrl(entry, 'https://example.com/Wunschnagel/?code=private#/p/test'), 'https://example.com/Wunschnagel/#/s/' + 'a'.repeat(64))
  assert.throws(() => savedListUrl({ kind: 'public', value: 'https://evil.example' }, 'https://example.com/'), /Ungültig/)
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem() { throw new Error('quota') } } })
  try { assert.throws(() => writeSavedLists([entry]), /nicht dauerhaft speichern/) }
  finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else Reflect.deleteProperty(globalThis, 'localStorage') }
})

test('bookmarks are private, authenticated-only and cannot grant edit or membership', async () => {
  const list = await fixture()
  await role()
  await assert.rejects(save(list), /permission denied/)
  await assert.rejects(bookmarks(), /permission denied/)
  await role(guest)
  const first = await save(list)
  assert.deepEqual(Object.keys(first).sort(), ['available','emoji','kind','list_id','saved_at','title','value'].sort())
  assert.equal((await bookmarks()).filter(row => row.list_id === list.id).length, 1)
  await save(list)
  assert.equal((await bookmarks()).filter(row => row.list_id === list.id).length, 1)
  for (const query of ['select * from public.wishlist_bookmarks', 'delete from public.wishlist_bookmarks', 'truncate public.wishlist_bookmarks']) await assert.rejects(db.exec(query), /permission denied/)
  for (const query of ['select public.get_wishlist_bookmarks($1)', 'select public.delete_wishlist_bookmark($2,$1)']) await assert.rejects(db.query(query, query.includes('$2') ? [owner, list.id] : [owner]), /Konto/)
  await assert.rejects(save(list, owner), /Konto/)
  assert.deepEqual((await db.query('select * from public.wishlists where id=$1', [list.id])).rows, [])
  assert.deepEqual((await db.query('select * from public.get_my_wishlists()')).rows, [])
  await role(owner)
  assert.equal((await bookmarks(owner)).some(row => row.list_id === list.id), false)
  await db.query('select public.delete_wishlist_bookmark($1,$2)', [list.id, owner])
  await role(guest)
  assert.equal((await bookmarks()).some(row => row.list_id === list.id), true)
})

test('revocation keeps only the old snapshot; new token refreshes one bookmark and deletion leaves a removable reference', async () => {
  const list = await fixture()
  await role(guest); await save(list)
  await role(owner)
  await db.query("update public.wishlists set visibility='private',title='NEW PRIVATE TITLE',emoji='🔒' where id=$1", [list.id])
  await role(guest)
  let entry = (await bookmarks()).find(row => row.list_id === list.id)!
  assert.equal(entry.available, false); assert.equal(entry.title, 'Geteilte Ideen'); assert.notEqual(entry.emoji, '🔒')
  await assert.rejects(save(list), /nicht mehr freigegeben/)
  await role(owner)
  await db.query("update public.wishlists set visibility='link',title='Wieder geteilt' where id=$1", [list.id])
  const token = (await db.query<{ value: string }>('select public.rotate_share_token($1) as value', [list.id])).rows[0].value
  await role(guest)
  await assert.rejects(save(list), /nicht mehr freigegeben/)
  await save({ share_token: token })
  assert.equal((await bookmarks()).filter(row => row.list_id === list.id).length, 1)
  entry = (await bookmarks()).find(row => row.list_id === list.id)!
  assert.equal(entry.value, token); assert.equal(entry.title, 'Wieder geteilt'); assert.equal(entry.available, true)
  await role(owner); await db.query('delete from public.wishlists where id=$1', [list.id])
  await role(guest)
  assert.equal((await bookmarks()).find(row => row.list_id === list.id)!.available, false)
  await db.query('select public.delete_wishlist_bookmark($1,$2)', [list.id, guest])
  assert.equal((await bookmarks()).some(row => row.list_id === list.id), false)
})

test('public list references require public visibility, enforce a per-account bound and permit updates at the limit', async () => {
  const list = await fixture('public'), privateList = await fixture('private')
  await role(guest)
  await db.query("select public.save_wishlist_bookmark('public',$1,$2)", [list.id, guest])
  await assert.rejects(db.query("select public.save_wishlist_bookmark('public',$1,$2)", [privateList.id, guest]), /nicht mehr freigegeben/)
  await assert.rejects(db.query("select public.save_wishlist_bookmark('public','invalid',$1)", [guest]), /nicht mehr freigegeben/)
  await db.exec('reset role')
  await db.query(`insert into public.wishlist_bookmarks(user_id,list_id,route_kind,route_value,title,emoji)
    select $1, gen_random_uuid(), 'token', repeat('f',64), 'Old reference','🎁' from generate_series(1,100-(select count(*)::int from public.wishlist_bookmarks where user_id=$1))`, [guest])
  await role(guest)
  assert.equal((await bookmarks()).length, 100)
  await db.query("select public.save_wishlist_bookmark('public',$1,$2)", [list.id, guest])
  const extra = await fixture(); await role(guest)
  await assert.rejects(save(extra), /bis zu 100/)
})
