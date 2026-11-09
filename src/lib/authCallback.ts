/** Bearer credentials in URLs are never accepted as a login for this app. */
export function sanitizeAuthCallback(href: string): { href: string; warning: string } {
  const url = new URL(href)
  const fragment = new URLSearchParams(url.hash.startsWith('#/') ? '' : url.hash.slice(1))
  const credentials = ['access_token', 'refresh_token', 'provider_token', 'provider_refresh_token', 'token_type', 'expires_in', 'expires_at']
  const errors = ['error', 'error_description', 'error_code']
  const hasCredentials = credentials.some(key => url.searchParams.has(key) || fragment.has(key))
  const hasError = errors.some(key => url.searchParams.has(key) || fragment.has(key))
  for (const key of [...credentials, ...errors]) { url.searchParams.delete(key); fragment.delete(key) }
  if (!url.hash.startsWith('#/')) url.hash = fragment.toString()
  return { href: url.href, warning: hasCredentials ? 'Dieser unsichere Anmeldelink wurde verworfen. Starte „Mit Google anmelden“ erneut.' : hasError ? 'Die Google-Anmeldung wurde nicht abgeschlossen. Bitte versuche es erneut.' : '' }
}
