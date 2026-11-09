/** Build-time guard: never emit a server credential into the static app. */
export function assertPublicConfiguration(key?: string): void {
  if (!key) return
  let role = ''
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role || '' } catch { /* New publishable keys aren't JWTs. */ }
  if (/^(?:sb_secret_|sbp_|gh[pousr]_)/.test(key) || role === 'service_role') throw new Error('Ein Server-Schlüssel darf nicht in VITE_SUPABASE_PUBLISHABLE_KEY stehen. Verwende nur einen Publishable- oder Anon-Key.')
}

export function contentSecurityPolicy(supabaseUrl?: string): string {
  const connections = ["'self'"]
  if (supabaseUrl && !supabaseUrl.includes('YOUR_PROJECT')) {
    const url = new URL(supabaseUrl)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Die veröffentlichte Supabase-Verbindung muss eine HTTPS-Adresse ohne Zugangsdaten sein.')
    connections.push(url.origin, url.origin.replace(/^https:/, 'wss:'))
  }
  return ["default-src 'none'", "script-src 'self'", "script-src-attr 'none'", "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https:", "font-src 'self'", `connect-src ${connections.join(' ')}`, "manifest-src 'self'", "worker-src 'self'",
    "frame-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"].join('; ')
}
