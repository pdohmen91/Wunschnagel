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
]

export function shopDestination(value: string, allowedHosts: readonly string[]): URL {
  const url = destination(value)
  // Exact host matching also prevents DNS rebinding through arbitrary domains.
  // Custom shops can be explicitly trusted by the project owner in a secret.
  if (!allowedHosts.includes(url.hostname)) throw new Error('Für diesen Shop bitte Titel und Bild-Link manuell ergänzen.')
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
  return value.replace(/&(?:amp|quot|apos|lt|gt|#39|#(\d+)|#x([0-9a-f]+));/gi, (match, dec, hex) => {
    if (dec || hex) { const code = parseInt(dec || hex, hex ? 16 : 10); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '' }
    return ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>' } as Record<string, string>)[match.toLowerCase()] || match
  }).trim()
}

export function metadata(html: string, base: string): { title: string; image_url: string; description: string } {
  const tags = new Map<string, string>()
  for (const match of html.matchAll(/<meta\s+[^>]{0,8000}>/gi)) {
    const attrs = new Map<string, string>()
    for (const attr of match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs.set(attr[1].toLowerCase(), decode(attr[2] ?? attr[3] ?? attr[4] ?? ''))
    const key = (attrs.get('property') || attrs.get('name'))?.toLowerCase()
    if (key && attrs.has('content') && !tags.has(key)) tags.set(key, attrs.get('content')!)
  }
  const rawImage = tags.get('og:image:secure_url') || tags.get('og:image') || tags.get('twitter:image') || ''
  let image = ''
  try { if (rawImage) image = destination(new URL(rawImage, base).href).href } catch { /* No active/non-HTTPS image URLs. */ }
  return {
    title: (tags.get('og:title') || tags.get('twitter:title') || decode(html.match(/<title[^>]*>([^<]{0,1000})<\/title>/i)?.[1] || '')).slice(0, 200),
    image_url: image,
    description: (tags.get('og:description') || tags.get('description') || '').slice(0, 1000),
  }
}
