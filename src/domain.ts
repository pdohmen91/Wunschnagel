export type Visibility = 'private' | 'link' | 'public'
export type OfferSource = 'idealo' | 'ebay' | 'kleinanzeigen' | 'custom'
export type Wishlist = {
  id: string
  owner_id: string
  title: string
  description: string
  emoji: string
  visibility: Visibility
  share_token: string
  created_at: string
}
export type Wish = {
  id: string
  wishlist_id: string
  title: string
  url: string
  notes: string
  image_url: string
  price: number | null
  fulfilled: boolean
  created_at: string
  offer_source?: OfferSource
  search_term?: string
  search_url?: string
}
export type ListInput = Pick<Wishlist, 'title' | 'description' | 'emoji' | 'visibility'>
export type WishInput = Pick<Wish, 'title' | 'url' | 'notes' | 'image_url' | 'price' | 'offer_source' | 'search_term' | 'search_url'>
export type Preview = { title: string; image_url: string; description: string; price?: number | null }
export type SharedList = { list: Wishlist; items: Wish[] }
export type Collaboration = { invite: { token: string; expires_at: string } | null; members: { user_id: string; display_name: string; email?: string | null; joined_at: string }[] }
export type ListInvitation = { title: string; emoji: string; expires_at: string; already_joined: boolean }
export type WishSort = 'added' | 'newest' | 'name' | 'price-asc' | 'price-desc'

export const offerSources: Record<OfferSource, string> = {
  idealo: 'Preisvergleich · idealo',
  ebay: 'Gebrauchtangebote · eBay',
  kleinanzeigen: 'Kleinanzeigen',
  custom: 'Eigener Such- oder Preisvergleichslink',
}

export function offerSearch(wish: Pick<Wish, 'title' | 'offer_source' | 'search_term' | 'search_url'>): { url: string; label: string; provider: string; term: string } {
  const term = (wish.search_term?.trim() || wish.title.trim()).replace(/\s+/g, ' ').slice(0, 200)
  if (wish.offer_source === 'custom') {
    let url = ''
    try { url = webUrl(wish.search_url || '') } catch { /* Do not expose an invalid or active link. */ }
    return { url, label: 'Angebote finden', provider: hostname(url), term }
  }
  if (!term) return { url: '', label: 'Angebote finden', provider: '', term: '' }
  if (wish.offer_source === 'ebay') {
    const url = new URL('https://www.ebay.de/sch/i.html')
    url.searchParams.set('_nkw', term)
    // Used condition IDs include books/media. Exclude broken/parts-only listings.
    url.searchParams.set('LH_ItemCondition', '3000|4000|5000|6000')
    return { url: url.href, label: 'Gebraucht suchen', provider: 'eBay', term }
  }
  if (wish.offer_source === 'kleinanzeigen') {
    const url = new URL('https://www.kleinanzeigen.de/s-suchanfrage.html')
    url.searchParams.set('keywords', term)
    return { url: url.href, label: 'Angebote finden', provider: 'Kleinanzeigen', term }
  }
  const url = new URL('https://www.idealo.de/preisvergleich/MainSearchProductCategory.html')
  url.searchParams.set('q', term)
  return { url: url.href, label: 'Preisvergleich', provider: 'idealo', term }
}

export function sortWishes(items: readonly Wish[], order: WishSort): Wish[] {
  return [...items].sort((a, b) => {
    if (order === 'name') return a.title.localeCompare(b.title, 'de')
    if (order === 'price-asc' || order === 'price-desc') {
      if (a.price === null) return b.price === null ? 0 : 1
      if (b.price === null) return -1
      return order === 'price-asc' ? a.price - b.price : b.price - a.price
    }
    return order === 'newest' ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)
  })
}

export const visibilityLabels: Record<Visibility, string> = { private: 'Privat', link: 'Mit Link', public: 'Öffentlich' }
export const visibilityDescriptions: Record<Visibility, string> = {
  private: 'Nur du und ausdrücklich eingeladene Mitbearbeiter können diese Liste sehen.',
  link: 'Alle mit dem Link können die Liste ohne Anmeldung ansehen. Das gilt auch, wenn jemand den Link weitergibt.',
  public: 'Diese Liste ist öffentlich. Auch Personen außerhalb deiner Freunde und Familie dürfen sie ansehen.',
}

export function webUrl(value: string, required = true): string {
  const input = value.trim()
  if (!input && !required) return ''
  let url: URL
  const normalized = /^[a-z][a-z\d+.-]*:/i.test(input) ? input : /^([^\s/]+\.)+[^\s/]+(?:[/?#]|$)/.test(input) ? `https://${input}` : input
  try { url = new URL(normalized) } catch { throw new Error('Bitte gib einen gültigen Shop-Link ein, zum Beispiel shop.de/produkt.') }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Bitte verwende einen gültigen http- oder https-Link ohne Zugangsdaten.')
  }
  return url.href
}

export function hostname(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, '') } catch { return '' }
}

/** Shop sharing often copies a product name and a link together. */
export function sharedProduct(value: string): { url: string; title: string } | null {
  const text = value.trim()
  const matches = [...text.matchAll(/https?:\/\/[^\s<>"“”]+/gi)]
  if (matches.length !== 1) return null
  let link = matches[0][0].replace(/[.,;!?]+$/, '')
  for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
    while (link.endsWith(close) && link.split(close).length > link.split(open).length) link = link.slice(0, -1)
  }
  let url: string
  try { url = webUrl(link) } catch { return null }
  const prefix = text.slice(0, matches[0].index).trim().split(/\r?\n/).filter(Boolean).at(-1) || ''
  const generic = /^(?:schau(?:t)?\b|sieh\b|check out\b|look\b|ich habe\b|hier (?:ist|ein)\b|hey\b|teile\b|shared\b|sent\b)/i.test(prefix)
  const title = generic ? '' : prefix.replace(/^["'„“]+|["'”’\s:–-]+$/g, '').replace(/\s+/g, ' ').slice(0, 200)
  return { url, title }
}

export function parsePrice(value: string): number | null {
  if (!value.trim()) return null
  const price = Number(value.trim().replace(',', '.'))
  if (!Number.isFinite(price) || price < 0 || price > 999999.99) throw new Error('Bitte gib einen gültigen Preis zwischen 0 und 999.999,99 € ein.')
  return Math.round(price * 100) / 100
}

export function shareUrl(list: Wishlist, location: string): string {
  if (list.visibility === 'private') throw new Error('Private Listen können nicht geteilt werden.')
  const url = new URL(location)
  url.search = ''
  url.hash = list.visibility === 'link' ? `/s/${list.share_token}` : `/p/${list.id}`
  return url.href
}

export function readShareRoute(hash: string): { kind: 'token' | 'public'; value: string } | null {
  const match = hash.match(/^#\/(s|p)\/([a-zA-Z0-9-]{20,80})$/)
  return match ? { kind: match[1] === 's' ? 'token' : 'public', value: match[2] } : null
}

export function readInviteRoute(hash: string): string | null {
  return hash.match(/^#\/invite\/([a-f0-9]{64})$/)?.[1] || null
}

export function inviteUrl(token: string, location: string): string {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Ungültige Einladung.')
  const url = new URL(location)
  url.search = ''
  url.hash = `/invite/${token}`
  return url.href
}
