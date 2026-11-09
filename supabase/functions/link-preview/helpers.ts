import { PreviewError } from './errors.ts'
import { euroPrice, productMatch, structuredPrice } from './prices.ts'
import { storefrontPrice } from './storefrontPrices.ts'

/** Only public HTTPS destinations are allowed, including on each redirect. */
export const DEFAULT_SHOP_HOSTS = [
  'amazon.de', 'www.amazon.de', 'amzn.eu', 'amzn.to',
  'otto.de', 'www.otto.de', 'zalando.de', 'www.zalando.de',
  'ikea.com', 'www.ikea.com', 'thalia.de', 'www.thalia.de',
  'etsy.com', 'www.etsy.com', 'hugendubel.de', 'www.hugendubel.de',
  'mediamarkt.de', 'www.mediamarkt.de', 'saturn.de', 'www.saturn.de',
  'dm.de', 'www.dm.de', 'rossmann.de', 'www.rossmann.de',
  'decathlon.de', 'www.decathlon.de', 'apple.com', 'www.apple.com',
  'bialetti.com', 'www.bialetti.com', 'marshall.com', 'www.marshall.com',
  'avocadostore.de', 'www.avocadostore.de',
  'ebay.io', 'ebay.us', 'ebay.de', 'www.ebay.de', 'ebay.com', 'www.ebay.com',
  'eu.store.bambulab.com', 'fivi.gg', 'www.fivi.gg', 'dyson.de', 'www.dyson.de',
  'shop.tesla.com',
]

export function shopDestination(value: string, allowedHosts: readonly string[]): URL {
  const url = destination(value)
  // Exact host matching also prevents DNS rebinding through arbitrary domains.
  // Custom shops can be explicitly trusted by the project owner in a secret.
  if (!allowedHosts.includes(url.hostname)) throw new PreviewError('unsupported_shop', 'Diesen Shop können wir noch nicht automatisch auslesen. Bitte ergänze Titel und Bild selbst manuell.')
  return url
}

export function publicIPv4(value: string): boolean {
  const parts = value.split('.').map(Number)
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b, c] = parts
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113))
}

export function publicAddress(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, '')
  // Permit only global-unicast IPv6. Reject mapped IPv4, local addresses,
  // documentation, Teredo and 6to4 transition ranges.
  if (value.includes(':')) return /^[23][0-9a-f]{3}:/.test(value) && !/^(2001:(0{1,4}:|db8:|0?1[0-9a-f]:|2:)|2002:)/.test(value)
  return publicIPv4(value)
}

export function destination(value: string): URL {
  const url = new URL(value)
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
    !host.includes('.') || host.endsWith('.') || /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host) ||
    host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    throw new Error('Bitte verwende einen öffentlichen HTTPS-Shop-Link.')
  }
  if (url.href.length > 2000) throw new Error('Dieser Link ist zu lang.')
  return url
}

function decode(value: string): string {
  return value.replace(/&(?:amp|quot|apos|lt|gt|nbsp|euro|ndash|mdash|hellip|copy|reg|trade|#39|#(\d+)|#x([0-9a-f]+));/gi, (match, dec, hex) => {
    if (dec || hex) { const code = parseInt(dec || hex, hex ? 16 : 10); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '' }
    return ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&euro;': '€', '&ndash;': '–', '&mdash;': '—', '&hellip;': '…', '&copy;': '©', '&reg;': '®', '&trade;': '™' } as Record<string, string>)[match.toLowerCase()] || match
  }).trim()
}

function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const attr of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) result.set(attr[1].toLowerCase(), decode(attr[2] ?? attr[3] ?? attr[4] ?? ''))
  return result
}

export function imageUrl(value: unknown, base: string): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  try { return destination(new URL(value, base).href).href } catch { return '' }
}

function structuredProducts(html: string, base: string) {
  const products: Record<string, unknown>[] = []
  const references = new Map<string, Record<string, unknown>>()
  let visited = 0
  const visit = (value: unknown, depth: number) => {
    if (depth > 12 || ++visited > 2000 || !value || typeof value !== 'object') return
    if (Array.isArray(value)) { for (const entry of value) visit(entry, depth + 1); return }
    const node = value as Record<string, unknown>
    if (typeof node['@id'] === 'string') {
      try {
        const key = new URL(node['@id'], base).href
        if (Object.keys(node).length > Object.keys(references.get(key) || {}).length) references.set(key, node)
      } catch { /* Ignore invalid identifiers. */ }
    }
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']]
    if (types.some(type => typeof type === 'string' && /(?:^|[/#])Product(?:Group)?$/.test(type))) products.push(node)
    for (const entry of Object.values(node)) visit(entry, depth + 1)
  }
  for (const match of html.matchAll(/<script\b([^>]{0,8000})>([\s\S]*?)<\/script\s*>/gi)) {
    if (attributes(match[1]).get('type')?.toLowerCase() !== 'application/ld+json') continue
    try { visit(JSON.parse(match[2]), 0) } catch { /* Ignore malformed or incomplete structured data. */ }
  }
  return { products, references }
}

function structuredImage(value: unknown, base: string, references: Map<string, Record<string, unknown>>, depth = 0): string {
  if (depth > 4) return ''
  if (typeof value === 'string') return imageUrl(value, base)
  if (Array.isArray(value)) {
    for (const entry of value) { const image = structuredImage(entry, base, references, depth + 1); if (image) return image }
  } else if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>
    const direct = imageUrl(object.contentUrl, base) || imageUrl(object.url, base)
    if (direct) return direct
    if (typeof object['@id'] === 'string') {
      try {
        const reference = references.get(new URL(object['@id'], base).href)
        if (reference && reference !== object) return structuredImage(reference, base, references, depth + 1)
      } catch { /* Ignore invalid identifiers. */ }
    }
  }
  return ''
}

function plainText(value: string): string { return decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim() }

export function rejectChallengePage(html: string): void {
  const title = plainText(html.match(/<title[^>]*>([\s\S]{0,2000}?)<\/title>/i)?.[1] || '')
  if (/^(?:just a moment|access denied|robot check|client challenge|attention required|pardon our interruption|zugriff verweigert|captcha)\b/i.test(title) || /<form\b[^>]*action\s*=\s*["'][^"']*validateCaptcha/i.test(html)) {
    throw new PreviewError('shop_blocked', 'Dieser Shop verlangt eine Prüfung im Browser und blockiert den automatischen Abruf. Titel und Bild kannst du selbst ergänzen.')
  }
}

function microdataPrice(html: string): number | null {
  const prices: string[] = [], currencies: string[] = []
  // Scripts can contain HTML templates unrelated to the displayed product.
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
  for (const match of markup.matchAll(/<([a-z][\w:-]*)\b[^>]{0,8000}>/gi)) {
    const attrs = attributes(match[0])
    const props = attrs.get('itemprop')?.toLowerCase().split(/\s+/) || []
    if (!props.includes('price') && !props.includes('pricecurrency')) continue
    const value = attrs.get('content') ?? attrs.get('value') ?? plainText(markup.slice(match.index! + match[0].length).match(/^[\s\S]{0,300}?(?=<\/)/)?.[0] || '')
    if (props.includes('price')) prices.push(value)
    if (props.includes('pricecurrency')) currencies.push(value)
  }
  if (!prices.length || new Set(currencies.map(value => value.toUpperCase())).size > 1) return null
  const amounts = prices.map(value => euroPrice(value, currencies[0]))
  return amounts[0] !== null && amounts.every(value => value === amounts[0]) ? amounts[0] : null
}

export function metadata(html: string, base: string): { title: string; image_url: string; description: string; price: number | null } {
  const tags = new Map<string, string>()
  for (const match of html.matchAll(/<meta\s+[^>]{0,8000}>/gi)) {
    const attrs = attributes(match[0])
    const key = (attrs.get('property') || attrs.get('name') || (attrs.get('itemprop')?.split(/\s+/).includes('image') ? 'image' : ''))?.toLowerCase()
    if (key && attrs.get('content') && !tags.has(key)) tags.set(key, attrs.get('content')!)
  }
  let image = ''
  for (const key of ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src', 'image']) {
    image = imageUrl(tags.get(key), base)
    if (image) break
  }
  const { products, references } = structuredProducts(html, base)
  // Prefer the product whose URL belongs to the opened page over recommendations.
  products.sort((a, b) => productMatch(b.url ?? b['@id'], base) - productMatch(a.url ?? a['@id'], base))
  if (!image) for (const product of products) { image = structuredImage(product.image, base, references); if (image) break }
  if (!image) for (const match of html.matchAll(/<link\b[^>]{0,8000}>/gi)) {
    const attrs = attributes(match[0])
    if (attrs.get('rel')?.toLowerCase().split(/\s+/).includes('image_src')) image = imageUrl(attrs.get('href'), base)
    if (image) break
  }
  if (!image) for (const match of html.matchAll(/<img\b[^>]{0,16000}>/gi)) {
    const attrs = attributes(match[0])
    // Use identified product images, never arbitrary logos, banners or tracking pixels.
    const amazonProduct = ['landingImage', 'imgBlkFront'].includes(attrs.get('id') || '') && /(^|\.)amazon\.[a-z.]+$/.test(new URL(base).hostname)
    const productImage = attrs.get('itemprop')?.split(/\s+/).includes('image')
    if (!amazonProduct && !productImage) continue
    image = imageUrl(attrs.get('data-old-hires'), base) || imageUrl(attrs.get('data-src'), base) || imageUrl(attrs.get('src'), base)
    if (image) break
  }
  const productTitle = products.find(product => typeof product.name === 'string')?.name as string | undefined
  const productDescription = products.find(product => typeof product.description === 'string')?.description as string | undefined
  let canonical: string | undefined
  for (const match of html.matchAll(/<link\b[^>]{0,8000}>/gi)) {
    const attrs = attributes(match[0])
    if (attrs.get('rel')?.toLowerCase().split(/\s+/).includes('canonical')) {
      try { const url = new URL(attrs.get('href') || '', base); if (url.origin === new URL(base).origin) canonical = url.href } catch { /* Ignore malformed canonical URLs. */ }
      break
    }
  }
  const price = structuredPrice(products, base, references, canonical)
    ?? euroPrice(tags.get('product:price:amount'), tags.get('product:price:currency'))
    ?? euroPrice(tags.get('og:price:amount'), tags.get('og:price:currency'))
    ?? microdataPrice(html)
    ?? storefrontPrice(html, base, plainText)
  return {
    title: plainText(tags.get('og:title') || tags.get('twitter:title') || productTitle || html.match(/<title[^>]*>([\s\S]{0,2000}?)<\/title>/i)?.[1] || html.match(/<h1\b[^>]*>([\s\S]{0,8000}?)<\/h1>/i)?.[1] || '').slice(0, 200),
    image_url: image,
    description: plainText(tags.get('og:description') || tags.get('description') || productDescription || '').slice(0, 1000),
    price,
  }
}
