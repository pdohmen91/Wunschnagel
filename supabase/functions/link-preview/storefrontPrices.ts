import { euroPrice } from './prices.ts'

// Read a JSON argument embedded in server-rendered HTML. Never evaluate shop
// JavaScript. Bracket/string tracking prevents cutting at braces inside strings.
function jsonArgument(script: string, start: number): unknown {
  if (script[start] !== '{') return null
  let depth = 0, quoted = false, escaped = false
  for (let index = start; index < script.length; index++) {
    const char = script[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
      continue
    }
    if (char === '"') quoted = true
    else if (char === '{' || char === '[') { if (++depth > 80) return null }
    else if (char === '}' || char === ']') {
      if (--depth === 0) {
        try { return JSON.parse(script.slice(start, index + 1)) } catch { return null }
      }
    }
  }
  return null
}

function zalandoPrice(html: string, url: URL): number | null {
  const sku = url.pathname.match(/([a-z0-9]{6,}-[a-z0-9]+)\.html$/i)?.[1].toUpperCase()
  if (!sku) return null
  const fragments: { trackingCurrentAmount?: number; original?: { amount?: number; currency?: string; formatted?: string }; promotional?: { amount?: number; currency?: string; formatted?: string } }[] = []
  for (const script of html.matchAll(/<script\b[^>]{0,8000}>([\s\S]*?)<\/script\s*>/gi)) {
    const marker = /runtime\[['"]hydratePartial['"]\]\s*\(\s*/.exec(script[1])
    if (!marker) continue
    const data = jsonArgument(script[1], marker.index + marker[0].length) as { cache?: Record<string, { data?: { product?: { sku?: string; id?: string; displayPrice?: { trackingCurrentAmount?: number; original?: { amount?: number; currency?: string }; promotional?: { amount?: number; currency?: string } } } } }> } | null
    if (!data?.cache || typeof data.cache !== 'object') continue
    for (const entry of Object.values(data.cache).slice(0, 2000)) {
      const product = entry?.data?.product
      if (!product || (typeof product.sku !== 'string' || product.sku.toUpperCase() !== sku) && product.id !== `ern:product::${sku}`) continue
      if (product.displayPrice) fragments.push(product.displayPrice)
    }
  }
  // The hydration cache splits the same product into partial query responses.
  // Merge only its currency/active-price fragments, never recommendation data.
  const currencies = new Set(fragments.flatMap(price => [price.original?.currency, price.promotional?.currency]).filter(Boolean).map(currency => currency!.toUpperCase()))
  if (currencies.size !== 1 || !currencies.has('EUR')) return null
  const sale = fragments.some(price => price.promotional)
  const prices = fragments.map(price => {
    const active = sale ? price.promotional : price.original
    if (!active) return null
    return typeof active.amount === 'number' && Number.isSafeInteger(active.amount) ? euroPrice(active.amount / 100, 'EUR') : euroPrice(active.formatted, 'EUR')
  }).filter((price): price is number => price !== null)
  if (!prices.length || !prices.every(price => price === prices[0])) return null
  if (fragments.some(price => price.trackingCurrentAmount !== undefined && Math.abs(price.trackingCurrentAmount - prices[0]) > 0.001)) return null
  return prices[0]
}

/** Shop-specific fallback limited to observed, unambiguous primary price fields. */
export function storefrontPrice(html: string, base: string, plainText: (value: string) => string): number | null {
  const url = new URL(base)
  if (['zalando.de', 'www.zalando.de'].includes(url.hostname)) return zalandoPrice(html, url)
  const markup = html.replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)\s*>/gi, '')
  if (['amazon.de', 'www.amazon.de'].includes(url.hostname)) {
    for (const id of ['apex-pricetopay-accessibility-label', 'priceblock_dealprice', 'priceblock_ourprice', 'price_inside_buybox']) {
      const match = markup.match(new RegExp(`<[^>]{0,2000}\\bid=["']${id}["'][^>]*>([^<]{1,300})<`, 'i'))
      const price = euroPrice(match ? plainText(match[1]) : null, undefined)
      if (price !== null) return price
    }
    const primary = /<span\b[^>]{0,2000}\bclass=["'][^"']*\b(?:apex-pricetopay-value|priceToPay)\b[^"']*["'][^>]*>/i.exec(markup)
    if (primary) {
      const text = markup.slice(primary.index + primary[0].length, primary.index + primary[0].length + 1200).match(/<span\b[^>]*class=["'][^"']*\ba-offscreen\b[^"']*["'][^>]*>([^<]{1,300})<\/span>/i)?.[1]
      return euroPrice(text ? plainText(text) : null, undefined)
    }
  }
  if (['ikea.com', 'www.ikea.com'].includes(url.hostname)) {
    const primary = /<span\b[^>]{0,2000}\bclass=["'][^"']*\b(?:pipcom|pip)-price-module__current-price\b[^"']*["'][^>]*>/i.exec(markup)
    if (primary) {
      const text = markup.slice(primary.index + primary[0].length, primary.index + primary[0].length + 1600).match(/<span\b[^>]*class=["'][^"']*\b(?:pipcom|pip)-price__sr-text\b[^"']*["'][^>]*>([^<]{1,300})<\/span>/i)?.[1]
      return euroPrice(text ? plainText(text).replace(/^(?:Preis|Price)\s*/i, '') : null, undefined)
    }
  }
  return null
}
