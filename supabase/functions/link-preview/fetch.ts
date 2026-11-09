import { metadata, publicAddress, rejectChallengePage, shopDestination } from './helpers.ts'
import { PreviewError, rejectShopStatus } from './errors.ts'
import { shopifyAmount, shopifyMetadata, shopifyProductUrl } from './shopify.ts'
import { euroPrice } from './prices.ts'

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
          onAbort = () => reject(new DOMException('Zeitüberschreitung.', 'TimeoutError'))
          signal.addEventListener('abort', onAbort, { once: true })
        }),
      ])
      if (!addresses.length || addresses.some(address => !publicAddress(address))) throw new PreviewError('unavailable', 'Dieser Shop-Link ist nicht erreichbar.')
    } finally { signal.removeEventListener('abort', onAbort) }
  }
  const trustedFetch = async (start: URL, accept: string) => {
    let url = shopDestination(start.href, allowedHosts)
    for (let redirect = 0; redirect < 4; redirect++) {
      await checkDns(url)
      const response = await fetcher(url, { signal, redirect: 'manual', headers: { Accept: accept, 'User-Agent': 'Wunschnagel-LinkPreview/1.0' } })
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        if (!location) throw new PreviewError('unavailable', 'Der Shop liefert einen ungültigen Weiterleitungslink.')
        url = shopDestination(new URL(location, url).href, allowedHosts)
        continue
      }
      return { response, url }
    }
    throw new PreviewError('unavailable', 'Der Shop leitet zu oft weiter. Bitte ergänze Titel und Bild selbst.')
  }

  // One shared limit covers JSON and HTML, including a fallback request.
  let remainingBytes = 1_048_576
  const readBody = async (response: Response, base: string, htmlPreview = false) => {
    const reader = response.body?.getReader()
    if (!reader) throw new PreviewError('no_metadata', 'Der Shop liefert keine Produktdaten.')
    const charset = response.headers.get('content-type')?.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] || 'utf-8'
    let decoder: TextDecoder
    try { decoder = new TextDecoder(charset) } catch { decoder = new TextDecoder() }
    let text = '', bytes = 0, nextProbe = 65_536, headRead = false
    const parameters = new URL(base).searchParams
    const selectedVariant = ['variant', 'sku', 'product'].some(key => parameters.has(key))
    try {
      while (remainingBytes > 0) {
        signal.throwIfAborted()
        const { done, value } = await reader.read()
        if (done) break
        const chunk = value.subarray(0, remainingBytes)
        text += decoder.decode(chunk, { stream: true })
        bytes += chunk.length
        remainingBytes -= chunk.length
        if (!htmlPreview) continue
        const headJustRead = !headRead && /<\/head\s*>/i.test(text)
        if (headJustRead) headRead = true
        if (headJustRead || bytes >= nextProbe) {
          nextProbe = bytes + 65_536
          const preview = metadata(text, base)
          // Price data often appears after the head, alongside Product JSON-LD.
          if (!selectedVariant && preview.title && preview.image_url && preview.price !== null) break
        }
      }
      return text + decoder.decode()
    } finally { await reader.cancel() }
  }
  const usableImage = async (preview: { title: string; image_url: string; description: string; price: number | null }) => {
    if (preview.image_url) {
      try { await checkDns(new URL(preview.image_url)) } catch { preview.image_url = '' }
    }
    return preview
  }

  const product = shopDestination(input, allowedHosts)
  const productApi = shopifyProductUrl(product)
  if (productApi) {
    const { response, url } = await trustedFetch(productApi, 'application/json')
    const type = response.headers.get('content-type') || ''
    if ([404, 405].includes(response.status)) await response.body?.cancel()
    else if (!response.ok) { await response.body?.cancel(); rejectShopStatus(response.status) }
    else if (!/(?:application\/(?:json|javascript)|text\/javascript)/i.test(type)) await response.body?.cancel()
    else {
      const body = await readBody(response, url.href)
      let data: unknown = null
      try { data = JSON.parse(body) } catch { /* Fall back to HTML if the response isn't product JSON. */ }
      const preview = shopifyMetadata(data, product)
      if (preview) {
        await usableImage(preview)
        const amount = shopifyAmount(data, product)
        if (amount !== null && remainingBytes > 0) {
          // Product JSON omits the presentment currency. Shopify documents the
          // read-only, anonymous cart endpoint as the way to identify it.
          // Never send visitor cookies, never add anything to a cart.
          const cartUrl = new URL(productApi.href.replace(/\/products\/[^/]+\.js$/, '/cart.js'))
          try {
            const { response: cart, url: cartBase } = await trustedFetch(cartUrl, 'application/json')
            if (cart.ok && /(?:application\/(?:json|javascript)|text\/javascript)/i.test(cart.headers.get('content-type') || '')) {
              const currency = JSON.parse(await readBody(cart, cartBase.href))?.currency
              preview.price = euroPrice(amount, currency)
            } else await cart.body?.cancel()
          } catch { /* Missing currency must not discard a useful title/image. */ }
        }
        return preview
      }
    }
  }

  if (remainingBytes <= 0) throw new PreviewError('no_metadata', 'Die Produktdaten sind zu groß für den automatischen Import. Bitte ergänze Titel und Bild selbst.')
  const { response, url } = await trustedFetch(product, 'text/html,application/xhtml+xml')
  if (!response.ok) { await response.body?.cancel(); rejectShopStatus(response.status) }
  if (!/(?:text\/html|application\/xhtml\+xml)/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel()
    throw new PreviewError('no_metadata', 'Dieser Link führt nicht zu einer lesbaren Produktseite. Bitte ergänze Titel und Bild selbst.')
  }
  const html = await readBody(response, url.href, true)
  rejectChallengePage(html)
  const preview = metadata(html, url.href)
  if (!preview.title && !preview.image_url && preview.price === null) throw new PreviewError('no_metadata', 'Der Shop liefert keine auslesbaren Produktdaten. Du kannst Titel, Bild und Preis selbst ergänzen.')
  return usableImage(preview)
}
