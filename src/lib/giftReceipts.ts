// Browser-only proof for undo; never sent in share URLs or included in reads.
// Keep in-memory fallback when storage is unavailable, so the current tab can
// still recover from an accidental click. This contains no buyer identity.
const prefix = 'wunschnagel-gift-receipt:'
const memory = new Map<string, string>()
export function giftReceipt(id: string): string | null {
  try {
    const value = localStorage.getItem(prefix + id)
    if (value && /^[a-f0-9]{64}$/.test(value)) { memory.set(id, value); return value }
  } catch { /* Use this tab's fallback. */ }
  return memory.get(id) || null
}
export function ensureGiftReceipt(id: string): string {
  const existing = giftReceipt(id)
  if (existing) return existing
  const receipt = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
  // Save before the request so a lost response can be retried idempotently.
  memory.set(id, receipt)
  try { localStorage.setItem(prefix + id, receipt) } catch { /* Current tab can still undo. */ }
  return receipt
}
export function forgetGiftReceipt(id: string): void {
  memory.delete(id)
  try { localStorage.removeItem(prefix + id) } catch { /* Best effort. */ }
}
