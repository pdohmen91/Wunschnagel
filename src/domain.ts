export type Visibility = 'private' | 'link' | 'public'
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
}
export type ListInput = Pick<Wishlist, 'title' | 'description' | 'emoji' | 'visibility'>
export type WishInput = Pick<Wish, 'title' | 'url' | 'notes' | 'image_url' | 'price'>
export type Preview = { title: string; image_url: string; description: string }
export type SharedList = { list: Wishlist; items: Wish[] }
export type WishSort = 'added' | 'newest' | 'name' | 'price-asc' | 'price-desc'

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

export const visibilityLabels: Record<Visibility, string> = { private: 'Nur für mich', link: 'Mit Link', public: 'Öffentlich' }
export const visibilityDescriptions: Record<Visibility, string> = {
  private: 'Nur du kannst diese Liste sehen. Über „Liste teilen“ kannst du sie später freigeben.',
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
