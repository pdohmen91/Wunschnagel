import { imageUrl } from './helpers.ts'

// The documented public Ajax Product API needs no account or API key.
// Enable it only for reviewed stores; an unknown domain is never probed.
export function shopifyProductUrl(url: URL): URL | null {
  if (!['fivi.gg', 'www.fivi.gg'].includes(url.hostname)) return null
  const match = url.pathname.match(/^(\/(?:[a-z]{2}(?:-[a-z]{2})?)\/|\/)(?:collections\/[^/]+\/)?products\/([^/]+)\/?$/i)
  if (!match) return null
  return new URL(`${match[1]}products/${match[2]}.js`, url.origin)
}

export function shopifyMetadata(value: unknown, productUrl: URL): { title: string; image_url: string; description: string } | null {
  if (!value || typeof value !== 'object') return null
  const product = value as Record<string, unknown>
  if (!product.id || typeof product.title !== 'string' || !product.title.trim()) return null
  const variants = Array.isArray(product.variants) ? product.variants : []
  const variantId = productUrl.searchParams.get('variant')
  const variant = variantId ? variants.find(entry => entry && typeof entry === 'object' && String(entry.id) === variantId) : null
  const variantsTitle = typeof variant?.title === 'string' && variant.title !== 'Default Title' ? ` – ${variant.title}` : ''
  const imageValue = (input: unknown): string => {
    if (typeof input === 'string') return imageUrl(input, productUrl.href)
    if (input && typeof input === 'object') {
      const image = input as Record<string, unknown>
      return imageUrl(image.src, productUrl.href) || imageUrl(image.url, productUrl.href)
    }
    return ''
  }
  let image = imageValue(variant?.featured_image) || imageValue(product.featured_image)
  if (!image && Array.isArray(product.images)) {
    for (const entry of product.images) { image = imageValue(entry); if (image) break }
  }
  return { title: `${product.title}${variantsTitle}`.replace(/\s+/g, ' ').trim().slice(0, 200), image_url: image, description: '' }
}
