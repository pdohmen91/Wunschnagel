// Opt-in production checks. Only explicitly created QA accounts are accessed.
// No emails are sent, no real users or lists are queried, no TRUNCATE is run.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { signInQa } from './qa-auth.mjs'

const { url, publishable_key: key } = JSON.parse(readFileSync(process.env.WUNSCHNAGEL_QA_CONFIG, 'utf8'))
const ref = new URL(url).hostname.split('.')[0]
const keys = JSON.parse(execFileSync(process.env.WUNSCHNAGEL_QA_SUPABASE || 'supabase', ['projects', 'api-keys', `--remote=${ref}`, '--reveal', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(url, keys.find(k => k.type === 'secret').api_key, options), anon = createClient(url, key, options)
const users = []; let checks = 0, phase = 'setup'
async function ok(request) { const result = await request; assert.equal(result.error, null, result.error?.message); checks++; return result.data }
async function denied(request) { const result = await request; assert.ok(result.error, 'Expected permission rejection'); checks++; }
async function account(name) {
  const email = `wunschnagel-security-qa-${randomBytes(8).toString('hex')}@example.invalid`
  const { user } = await ok(admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } }))
  users.push(user.id)
  const client = createClient(url, key, options), signed = await signInQa(client, admin, email)
  assert.ok(signed.session.expires_in <= 900); checks++
  return { id: user.id, email, client, session: signed.session }
}
function safe(data) { assert.ok(data?.list); assert.equal('owner_id' in data.list, false); assert.equal('share_token' in data.list, false); checks++ }
try {
  phase = 'Google-only settings and admin-generated isolated QA sessions'
  const settings = await fetch(url + '/auth/v1/settings', { headers: { apikey: key } }).then(r => r.json())
  assert.equal(settings.external.google, true); assert.equal(settings.external.email, false); assert.equal(settings.external.anonymous_users, false); checks++
  const owner = await account('QA Besitzer'), editor = await account('QA Mitbearbeiter'), outsider = await account('QA Außenstehend')
  if (process.env.WUNSCHNAGEL_QA_PREFLIGHT === '1') { console.log(JSON.stringify({ phase: 'Auth preflight passed', checks })); }
  else {
    phase = 'private, link and public projection boundaries'
    const list = await ok(owner.client.from('wishlists').insert({ owner_id: owner.id, title: '[QA] Security', visibility: 'link' }).select().single())
    const privateList = await ok(owner.client.from('wishlists').insert({ owner_id: owner.id, title: '[QA] Private', visibility: 'private' }).select().single())
    const wish = await ok(owner.client.from('wishes').insert({ wishlist_id: list.id, title: '[QA] Wish', url: 'https://example.com/qa' }).select().single())
    for (const guest of [anon, outsider.client]) {
      safe(await ok(guest.rpc('get_shared_wishlist', { token: list.share_token })))
      assert.equal(await ok(guest.rpc('get_shared_wishlist', { token: privateList.share_token })), null)
      assert.equal(await ok(guest.rpc('get_public_wishlist', { list_id: list.id })), null)
      await denied(guest.rpc('read_wishlist_payload', { list_id: privateList.id }))
    }
    await denied(anon.from('wishlists').select('id'))
    await denied(anon.from('wishes').select('id'))
    assert.deepEqual(await ok(outsider.client.from('wishlists').select('id').eq('id', list.id)), [])
    await denied(owner.client.from('wishlists').update({ visibility: 'public' }).eq('id', list.id))
    assert.equal(await ok(anon.rpc('get_public_wishlist', { list_id: list.id })), null)
    safe(await ok(anon.rpc('get_shared_wishlist', { token: list.share_token })))
    phase = 'immutable ownership, tokens and item parents; RLS independent of UI'
    for (const changes of [{ owner_id: outsider.id }, { id: privateList.id }, { share_token: 'a'.repeat(64) }, { created_at: new Date().toISOString() }]) await denied(owner.client.from('wishlists').update(changes).eq('id', list.id))
    await denied(owner.client.from('wishlists').insert({ owner_id: owner.id, title: '[QA] Weak', share_token: 'a'.repeat(64) }))
    await denied(owner.client.from('wishlists').insert({ owner_id: outsider.id, title: '[QA] Impersonation' }))
    await denied(owner.client.from('wishes').update({ wishlist_id: privateList.id }).eq('id', wish.id))
    assert.deepEqual(await ok(outsider.client.from('wishes').update({ title: '[QA] Forbidden' }).eq('id', wish.id).select('id')), [])
    assert.deepEqual(await ok(outsider.client.from('wishlists').delete().eq('id', list.id).select('id')), [])
    await denied(owner.client.from('creation_budgets').select('*'))
    await denied(anon.rpc('enforce_creation_limits'))
    phase = 'invitation privilege boundaries and verified identity'
    await ok(owner.client.rpc('create_wishlist_invite', { list_id: privateList.id }))
    const invite = (await ok(owner.client.rpc('get_collaboration', { list_id: privateList.id }))).invite.token
    await ok(editor.client.auth.updateUser({ data: { full_name: 'QA Besitzer', email: owner.email, role: 'service_role' } }))
    await ok(editor.client.rpc('accept_wishlist_invite', { invite_token: invite }))
    await ok(editor.client.from('wishes').insert({ wishlist_id: privateList.id, title: '[QA] Editor', url: 'https://example.com/qa' }))
    const members = (await ok(owner.client.rpc('get_collaboration', { list_id: privateList.id }))).members
    assert.equal(members.find(m => m.user_id === editor.id).email, editor.email); checks++
    const editorView = await ok(editor.client.rpc('get_collaboration', { list_id: privateList.id }))
    assert.equal(editorView.owner.user_id, owner.id); checks++
    assert.equal(editorView.members.find(m => m.user_id === editor.id).email, editor.email); checks++
    await ok(editor.client.rpc('create_wishlist_invite', { list_id: privateList.id }))
    await denied(editor.client.rpc('remove_wishlist_member', { list_id: privateList.id, member_id: owner.id }))
    await denied(editor.client.from('wishlists').update({ owner_id: editor.id }).eq('id', privateList.id))
    assert.deepEqual(await ok(editor.client.from('wishlists').update({ visibility: 'private' }).eq('id', privateList.id).select('id')), [{ id: privateList.id }])
    await ok(owner.client.rpc('remove_wishlist_member', { list_id: privateList.id, member_id: editor.id }))
    assert.deepEqual(await ok(editor.client.from('wishes').select('id').eq('wishlist_id', privateList.id)), [])
    await denied(editor.client.rpc('accept_wishlist_invite', { invite_token: invite }))
    phase = 'concurrent creation and preview quotas cannot be bypassed'
    assert.match(owner.id, /^[a-f0-9-]{36}$/)
    // SQL writes are restricted to this newly generated QA account. No broad
    // deletes or changes to another user's budgets are performed.
    execFileSync(process.env.WUNSCHNAGEL_QA_SUPABASE || 'supabase', ['db', 'query', `--remote=${ref}`, '--yes',
      `insert into public.creation_budgets(user_id,day,uses) values('${owner.id}',current_date,499) on conflict(user_id,day) do update set uses=499; insert into public.preview_budgets(user_id,day,uses) values('${owner.id}',current_date,39) on conflict(user_id,day) do update set uses=39;`], { stdio: ['ignore', 'pipe', 'pipe'] })
    const writes = await Promise.all([1, 2, 3].map(n => owner.client.from('wishes').insert({ wishlist_id: list.id, title: '[QA] Concurrent ' + n, url: 'https://example.com/qa' })))
    assert.equal(writes.filter(r => !r.error).length, 1)
    assert.equal(writes.filter(r => r.error?.code === '54000').length, 2); checks++
    const previews = await Promise.all([1, 2, 3].map(() => ok(owner.client.rpc('consume_preview_budget'))))
    assert.equal(previews.filter(Boolean).length, 1); checks++
    phase = 'edge request boundary rejects attacks without requesting shops'
    const endpoint = url + '/functions/v1/link-preview'
    const headers = { apikey: key, authorization: `Bearer ${owner.session.access_token}`, 'content-type': 'application/json', origin: 'https://pdohmen91.github.io' }
    const probes = [
      [{ ...headers, authorization: 'Bearer not-a-jwt' }, JSON.stringify({ url: 'https://www.thalia.de/qa' }), 401],
      [{ ...headers, origin: 'https://attacker.invalid' }, '{}', 403],
      [headers, 'x'.repeat(5000), 413],
      [{ ...headers, 'content-type': 'text/plain' }, '{}', 415],
      [headers, 'null', 400],
      [headers, JSON.stringify({ url: 'https://127.0.0.1/' }), 422],
    ]
    for (const [requestHeaders, body, expected] of probes) {
      const response = await fetch(endpoint, { method: 'POST', headers: requestHeaders, body, signal: AbortSignal.timeout(15000) })
      assert.equal(response.status, expected); assert.equal(response.headers.get('cache-control'), 'no-store'); checks++
      if (requestHeaders.origin !== headers.origin) assert.equal(response.headers.get('access-control-allow-origin'), null)
      await response.body?.cancel()
    }
    console.log(JSON.stringify({ result: 'production security checks passed', checks, qaAccounts: users.length }))
  }
} catch (error) { console.error(JSON.stringify({ phase, error: error.message })); process.exitCode = 1 }
finally { for (const id of users.reverse()) { const { error } = await admin.auth.admin.deleteUser(id); if (error) { console.error('QA cleanup failed for isolated account'); process.exitCode = 1 } } console.log(JSON.stringify({ cleanup: 'QA accounts removed', accounts: users.length })) }
