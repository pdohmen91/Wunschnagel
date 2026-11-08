import { metadata, publicAddress, shopDestination } from './helpers.ts'

export type PreviewFetchOptions = {
  allowedHosts: readonly string[]
  resolveAddresses: (host: string) => Promise<string[]>
  signal: AbortSignal
  fetcher?: typeof fetch
}

export async function fetchShopPreview(input: string, options: PreviewFetchOptions) {
  const { allowedHosts, resolveAddresses, signal, fetcher = fetch } = options
  const checkDns = async (url: URL) => {
    signal.throwIfAborted()
    let onAbort: () => void = () => {}
    try {
      const addresses = await Promise.race([
        resolveAddresses(url.hostname),
        new Promise<never>((_resolve, reject) => {
          onAbort = () => reject(new Error('Zeitüberschreitung.'))
          signal.addEventListener('abort', onAbort, { once: true })
        }),
      ])
      if (!addresses.length || addresses.some(address => !publicAddress(address))) throw new Error('Dieser Shop-Link ist nicht erreichbar.')
    } finally { signal.removeEventListener('abort', onAbort) }
  }
  let url = shopDestination(input, allowedHosts)
  for (let redirect = 0; redirect < 4; redirect++) {
    await checkDns(url)
    const response = await fetcher(url, { signal, redirect: 'manual', headers: { Accept: 'text/html', 'User-Agent': 'Wunschnagel-LinkPreview/1.0' } })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (!location) throw new Error('Ungültige Weiterleitung.')
      url = shopDestination(new URL(location, url).href, allowedHosts)
      continue
    }
    if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('text/html')) {
      await response.body?.cancel()
      throw new Error('Der Shop liefert keine Vorschau.')
    }
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Leere Shop-Antwort.')
    const decoder = new TextDecoder()
    let bytes = 0
    let html = ''
    let headRead = false
    let nextProbe = 65_536
    try {
      while (bytes < 1_048_576) {
        const { done, value } = await reader.read()
        if (done) break
        const allowed = value.subarray(0, 1_048_576 - bytes)
        html += decoder.decode(allowed, { stream: true })
        bytes += allowed.length
        const headJustRead = !headRead && /<\/head\s*>/i.test(html)
        if (headJustRead) headRead = true
        // Some shops put product images in the body instead of Open Graph tags.
        // Keep the one-megabyte cap; stop early as soon as an image is available.
        if (headJustRead || bytes >= nextProbe) {
          nextProbe = bytes + 65_536
          if (metadata(html, url.href).image_url) break
        }
      }
      html += decoder.decode()
    } finally { await reader.cancel() }
    const preview = metadata(html, url.href)
    if (preview.image_url) {
      try { await checkDns(new URL(preview.image_url)) } catch { preview.image_url = '' }
    }
    return preview
  }
  throw new Error('Zu viele Shop-Weiterleitungen.')
}
