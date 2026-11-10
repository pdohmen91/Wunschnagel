import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { clearLegacySavedLists, savedList, savedListUrl, validSavedList } from '../src/lib/savedLists.ts'

const owner = '00000000-0000-4000-8000-000000000021', guest = '00000000-0000-4000-8000-000000000022'
let legacyAccessible: string, legacyRevoked: string
let migratedPublic: { id: string; share_token: string }, revokedPublic: { id: string; share_token: string }, migratedSavedAt: unknown
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
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb not null default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
    insert into auth.users(id,raw_user_meta_data) values('${owner}','{"full_name":"Alex Winter","name":"Alex","email":"private@example.com"}'),('${guest}','{}');`)
  const root = new URL('../supabase/migrations/', import.meta.url)
  for (const name of (await readdir(root)).filter(name => name.endsWith('.sql')).sort()) {
    if (name === '202611100001_saved_list_owner_names.sql') {
      const accessible = await fixture(), revoked = await fixture()
      legacyAccessible = accessible.id; legacyRevoked = revoked.id
      await role(guest); await save(accessible); await save(revoked)
      await role(owner); await db.query("update public.wishlists set visibility='private' where id=$1", [revoked.id])
      await db.exec('reset role')
    }
    if (name === '202611100004_link_only_sharing.sql') {
      migratedPublic = await fixture('public'); revokedPublic = await fixture('public')
      await role(guest)
      for (const list of [migratedPublic, revokedPublic]) {
        const result = (await db.query<{ data: { saved_at: string } }>("select public.save_wishlist_bookmark('public',$1,$2) as data", [list.id, guest])).rows[0].data
        if (list.id === migratedPublic.id) migratedSavedAt = result.saved_at
      }
      await role(owner)
      await db.query("update public.wishlists set visibility='private',title='NEW PRIVATE TITLE' where id=$1", [revokedPublic.id])
      await db.exec('reset role')
    }
    await db.exec(await readFile(new URL(name, root), 'utf8'))
  }
})
after(async () => db.close())

test('account references validate safe routes and retire guest storage without reading or uploading it', () => {
  const entry = savedList({ id: owner, title: 'Für Alex', emoji: '🎁' }, { kind: 'token', value: 'a'.repeat(64) })
  assert.equal(validSavedList(entry), true)
  for (const owner_name of [undefined, null, 'Alex Winter']) assert.equal(validSavedList({ ...entry, owner_name }), true)
  for (const value of [null, {}, { ...entry, value: 'javascript:alert(1)' }, { ...entry, list_id: 'invalid' }, ...[42, {}, '', '   ', 'a'.repeat(101)].map(owner_name => ({ ...entry, owner_name }))]) assert.equal(validSavedList(value), false)
  assert.equal(savedListUrl(entry, 'https://example.com/Wunschnagel/?code=private#/p/test'), 'https://example.com/Wunschnagel/#/s/' + 'a'.repeat(64))
  assert.throws(() => savedListUrl({ kind: 'public', value: 'https://evil.example' }, 'https://example.com/'), /Ungültig/)
  assert.throws(() => savedList({ id: owner, title: 'Alt', emoji: '🎁' }, { kind: 'public', value: owner }), /Öffentliche Links/)
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), removed: string[] = []
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    removeItem(key: string) { removed.push(key) },
    getItem() { assert.fail('Must never read guest bookmarks') },
    setItem() { assert.fail('Must never write guest bookmarks') },
  } })
  try {
    clearLegacySavedLists()
    assert.deepEqual(removed, ['wunschnagel-saved-lists-v1'])
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('storage blocked') } })
    assert.doesNotThrow(clearLegacySavedLists)
  } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else Reflect.deleteProperty(globalThis, 'localStorage') }
})

test('bookmarks are private, authenticated-only and cannot grant edit or membership', async () => {
  const list = await fixture()
  await role()
  await assert.rejects(save(list), /permission denied/)
  await assert.rejects(bookmarks(), /permission denied/)
  await role(guest)
  const first = await save(list)
  assert.deepEqual(Object.keys(first).sort(), ['available','emoji','kind','list_id','owner_name','saved_at','title','value'].sort())
  assert.equal(first.owner_name, 'Alex Winter')
  await assert.rejects(db.query('select public.wishlist_owner_name($1)', [owner]), /permission denied/)
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

test('existing accessible bookmarks gain owner names without exposing names through revoked links', async () => {
  await role(guest)
  const entries = await bookmarks()
  assert.equal(entries.find(row => row.list_id === legacyAccessible)!.owner_name, 'Alex Winter')
  assert.equal(entries.find(row => row.list_id === legacyRevoked)!.owner_name, null)
})

test('formerly public lists gain secret links and existing valid bookmarks migrate without reviving revoked access', async () => {
  await role(owner)
  const converted = (await db.query<{ visibility: string; share_token: string }>('select visibility,share_token from public.wishlists where id=$1', [migratedPublic.id])).rows[0]
  assert.equal(converted.visibility, 'link')
  assert.notEqual(converted.share_token, migratedPublic.share_token)
  await assert.rejects(db.query("insert into public.wishlists(owner_id,title,visibility) values($1,'No public mode','public')", [owner]), /wishlists_visibility_check/)
  await assert.rejects(db.query("update public.wishlists set visibility='public' where id=$1", [migratedPublic.id]), /wishlists_visibility_check/)
  await role(guest)
  const entries = await bookmarks()
  const migrated = entries.find(row => row.list_id === migratedPublic.id)!
  assert.equal(migrated.kind, 'token'); assert.equal(migrated.value, converted.share_token)
  assert.equal(migrated.available, true); assert.equal(migrated.saved_at, migratedSavedAt)
  const revoked = entries.find(row => row.list_id === revokedPublic.id)!
  assert.equal(revoked.kind, 'public'); assert.equal(revoked.available, false)
  assert.equal(revoked.title, 'Geteilte Ideen')
  await assert.rejects(db.query("select public.save_wishlist_bookmark('public',$1,$2)", [migratedPublic.id, guest]), /nicht mehr freigegeben/)
  for (const user of [undefined, guest, owner]) {
    await role(user)
    assert.equal((await db.query<{ value: unknown }>('select public.get_public_wishlist($1) as value', [migratedPublic.id])).rows[0].value, null)
  }
  await role()
  assert.equal((await db.query<{ value: unknown }>('select public.get_shared_wishlist($1) as value', [migratedPublic.share_token])).rows[0].value, null)
  assert.equal((await db.query<{ value: { list: { id: string } } }>('select public.get_shared_wishlist($1) as value', [converted.share_token])).rows[0].value.list.id, migratedPublic.id)
})

test('owner names refresh only through valid routes and retain their saved snapshot after revocation', async () => {
  const list = await fixture()
  await role(guest)
  assert.equal((await save(list)).owner_name, 'Alex Winter')
  await db.exec('reset role')
  await db.query('update auth.users set raw_user_meta_data=$1 where id=$2', [{ full_name: '  ', name: '  Alexandra  ', email: 'private@example.com' }, owner])
  await role(guest)
  assert.equal((await bookmarks()).find(row => row.list_id === list.id)!.owner_name, 'Alexandra')
  assert.equal((await save(list)).owner_name, 'Alexandra')
  await role(owner)
  await db.query("update public.wishlists set visibility='private' where id=$1", [list.id])
  await db.exec('reset role')
  await db.query('update auth.users set raw_user_meta_data=$1 where id=$2', [{ full_name: 'NEW PRIVATE NAME' }, owner])
  await role(guest)
  assert.equal((await bookmarks()).find(row => row.list_id === list.id)!.owner_name, 'Alexandra')
  await role(owner); await db.query('delete from public.wishlists where id=$1', [list.id])
  await role(guest)
  assert.equal((await bookmarks()).find(row => row.list_id === list.id)!.owner_name, 'Alexandra')
  await db.exec('reset role')
  await db.query('update auth.users set raw_user_meta_data=$1 where id=$2', [{ email: 'private@example.com' }, owner])
  const nameless = await fixture()
  await role(guest)
  const empty = await save(nameless)
  assert.equal(empty.owner_name, null)
  assert.equal((await bookmarks()).find(row => row.list_id === nameless.id)!.owner_name, null)
  await db.exec('reset role')
  await db.query('update auth.users set raw_user_meta_data=$1 where id=$2', [{ full_name: 'Alex Winter' }, owner])
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

test('only shared tokens can be saved; per-account limits permit updates at the limit', async () => {
  const list = await fixture(), privateList = await fixture('private')
  await role(guest)
  await save(list)
  await assert.rejects(db.query("select public.save_wishlist_bookmark('public',$1,$2)", [list.id, guest]), /nicht mehr freigegeben/)
  await assert.rejects(save(privateList), /nicht mehr freigegeben/)
  await assert.rejects(db.query("select public.save_wishlist_bookmark('public','invalid',$1)", [guest]), /nicht mehr freigegeben/)
  await db.exec('reset role')
  await db.query(`insert into public.wishlist_bookmarks(user_id,list_id,route_kind,route_value,title,emoji)
    select $1, gen_random_uuid(), 'token', repeat('f',64), 'Old reference','🎁' from generate_series(1,100-(select count(*)::int from public.wishlist_bookmarks where user_id=$1))`, [guest])
  await role(guest)
  assert.equal((await bookmarks()).length, 100)
  await save(list)
  const extra = await fixture(); await role(guest)
  await assert.rejects(save(extra), /bis zu 100/)
})
