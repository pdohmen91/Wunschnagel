/** The app stores EUR only. Never silently label foreign/unknown money as EUR. */
export function euroPrice(value: unknown, currency: unknown): number | null {
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : ''
  if (code && !['EUR', '€'].includes(code)) return null
  if (!code && !(typeof value === 'string' && /(?:€|\bEUR\b)/i.test(value))) return null
  let amount: number
  if (typeof value === 'number') amount = value
  else if (typeof value === 'string') {
    let text = value.trim().replace(/^(?:EUR|€)\s*|\s*(?:EUR|€)$/gi, '').trim().replace(/[\u00a0\u202f]/g, ' ')
    if (/^\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})?$/.test(text)) text = text.replaceAll(' ', '')
    if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(text)) text = text.replaceAll('.', '').replace(',', '.')
    else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(text)) text = text.replaceAll(',', '')
    else if (/^\d+(?:[.,]\d{1,2})?$/.test(text)) text = text.replace(',', '.')
    else return null // Ranges, monthly rates, signs and ambiguous "1.234".
    amount = Number(text)
  } else return null
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999.99) return null
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

type Node = Record<string, unknown>
const node = (value: unknown): Node | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Node : null

function dereference(value: unknown, base: string, references: Map<string, Node>, depth = 0): Node | null {
  const object = node(value)
  if (!object || depth > 4) return null
  if (typeof object['@id'] === 'string') {
    try {
      const ref = references.get(new URL(object['@id'], base).href)
      if (ref && ref !== object) return { ...dereference(ref, base, references, depth + 1), ...object }
    } catch { /* Malformed schema IDs are not product prices. */ }
  }
  return object
}

/** Stronger URL matches distinguish the selected variant from recommendations. */
const selectionKeys = ['variant', 'variant_id', 'id', 'sku', 'product', 'pid']
const productPath = (url: URL) => url.pathname.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/products\/)/i, '').replace(/\/$/, '')

export function productMatch(value: unknown, base: string): number {
  if (typeof value !== 'string') return 0
  try {
    const target = new URL(base), candidate = new URL(value, base)
    if (candidate.origin !== target.origin || productPath(candidate) !== productPath(target)) return -1
    let selected = false
    for (const key of selectionKeys) {
      const variant = candidate.searchParams.get(key)
      if (!variant) continue
      if (variant !== target.searchParams.get(key)) return -1
      selected = true
    }
    return selected ? 3 : 2
  } catch { return -1 }
}

function onePrice(values: (number | null)[]): number | null {
  // Multiple different amounts are a range, not a definite selected price.
  if (!values.length || values.some(value => value === null)) return null
  return values.every(value => value === values[0]) ? values[0] : null
}

function offerPrice(offer: Node, base: string, references: Map<string, Node>, fallbackCurrency?: unknown): number | null {
  const currency = offer.priceCurrency ?? fallbackCurrency
  // An explicit active price takes precedence over MSRP/struck-through prices.
  if (offer.price !== undefined) return euroPrice(offer.price, currency)
  if (offer.lowPrice !== undefined || offer.highPrice !== undefined) {
    const low = euroPrice(offer.lowPrice, currency), high = euroPrice(offer.highPrice, currency)
    return low !== null && low === high ? low : null
  }
  const specs = Array.isArray(offer.priceSpecification) ? offer.priceSpecification : [offer.priceSpecification]
  const active = specs.map(spec => dereference(spec, base, references)).filter((spec): spec is Node => !!spec && !spec.priceType && !spec.billingDuration && !spec.billingIncrement)
  return onePrice(active.map(spec => euroPrice(spec.price, spec.priceCurrency ?? currency)))
}

export function structuredPrice(products: Node[], base: string, references: Map<string, Node>, canonical?: string): number | null {
  if (!products.length) return null
  const target = new URL(base)
  const sku = ['sku', 'product', 'pid', 'id', 'variant_id'].map(key => target.searchParams.get(key)).find(Boolean)
  const ranked = products.map(product => {
    let samePath = !product.url
    try { if (typeof product.url === 'string') samePath = productPath(new URL(product.url, base)) === productPath(target) } catch { /* Invalid product URL. */ }
    // Some server-rendered shops publish their internal storefront hostname.
    // An exact selected SKU and product path still identify the same product;
    // this never fetches or trusts that hostname as a network destination.
    const exactSku = sku && String(product.sku) === sku && samePath
    return { product, score: exactSku ? 4 : Math.max(productMatch(product.url ?? product['@id'], base), canonical && productMatch(product.url ?? product['@id'], canonical) > 0 ? 1 : -1) }
  })
  const best = Math.max(...ranked.map(entry => entry.score))
  // A single Product with no URL is common. Multiple anonymous products cannot
  // be safely distinguished from recommendation cards.
  const selected = best > 0 ? ranked.filter(entry => entry.score === best) : ranked.length === 1 && best === 0 ? ranked : []
  if (!selected.length) return null
  return onePrice(selected.map(({ product }) => {
    const input = Array.isArray(product.offers) ? product.offers : [product.offers]
    let offers = input.slice(0, 250).map(value => dereference(value, base, references)).filter((value): value is Node => !!value)
    if (sku && offers.some(offer => offer.sku != null)) offers = offers.filter(offer => String(offer.sku) === sku)
    const scores = offers.map(offer => productMatch(offer.url, base))
    const matchingVariant = scores.some(score => score === 3)
    let matching = offers.filter((_offer, index) => matchingVariant ? scores[index] === 3 : scores[index] >= 0)
    // These product pages default to new goods; refurbished alternatives are
    // separate offers. A URL with an explicit selection stays conservative.
    if (['www.mediamarkt.de', 'mediamarkt.de', 'www.saturn.de', 'saturn.de'].includes(target.hostname) && !target.search && matching.some(offer => typeof offer.itemCondition === 'string' && /(?:^|[/#])NewCondition$/.test(offer.itemCondition))) {
      matching = matching.filter(offer => typeof offer.itemCondition === 'string' && /(?:^|[/#])NewCondition$/.test(offer.itemCondition))
    }
    return onePrice(matching.map(offer => offerPrice(offer, base, references, product.priceCurrency)))
  }))
}
