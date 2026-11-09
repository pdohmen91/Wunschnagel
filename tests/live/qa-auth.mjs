// Admin-generated one-time links are returned to this process only. This API
// does not send email and keeps QA possible with public email login disabled.
export async function signInQa(api, admin, email) {
  const generated = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (generated.error) throw new Error(generated.error.message)
  const result = await api.auth.verifyOtp({ token_hash: generated.data.properties.hashed_token, type: 'magiclink' })
  if (result.error || !result.data.session) throw new Error(result.error?.message || 'QA session unavailable')
  return result.data
}

export async function openQaSession(page, base, supabaseUrl, session) {
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  await page.context().addInitScript(({ origin, storageKey, session }) => {
    if (window.location.origin !== origin || sessionStorage.getItem('qa-seeded-' + storageKey)) return
    localStorage.setItem(storageKey, JSON.stringify(session))
    sessionStorage.setItem('qa-seeded-' + storageKey, 'true')
  }, { origin: new URL(base).origin, storageKey, session })
  await page.goto(base)
}
