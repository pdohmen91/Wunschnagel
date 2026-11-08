import { supabase } from './client'
import type { ListInput, Wishlist, Wish, WishInput, Preview, SharedList } from '../domain'

export interface Repository {
  lists(): Promise<Wishlist[]>
  items(listId: string): Promise<Wish[]>
  createList(input: ListInput): Promise<Wishlist>
  updateList(id: string, input: ListInput): Promise<void>
  deleteList(id: string): Promise<void>
  rotateLink(id: string): Promise<string>
  saveItem(listId: string, input: WishInput, id?: string): Promise<void>
  deleteItem(id: string): Promise<void>
  fulfillItem(id: string, fulfilled: boolean): Promise<void>
  preview(url: string, signal?: AbortSignal): Promise<Preview>
  shared(kind: 'token' | 'public', value: string): Promise<SharedList>
}

const now = () => new Date().toISOString()
const id = () => crypto.randomUUID()
const STORAGE = 'herzenswuensche-demo-v1'

type DemoData = { lists: Wishlist[]; items: Wish[] }
function seed(): DemoData {
  const list = (title: string, emoji: string, description: string, visibility: Wishlist['visibility']): Wishlist => ({ id: id(), owner_id: 'demo', title, emoji, description, visibility, share_token: id() + id().replaceAll('-', ''), created_at: now() })
  const birthday = list('Kleine & große Wünsche', '🌿', 'Ein paar Dinge, über die ich mich freuen würde. Das schönste Geschenk ist aber gemeinsame Zeit.', 'link')
  const christmas = list('Für Weihnachten', '🎄', 'Für gemütliche Tage und kleine Überraschungen.', 'private')
  const home = list('Unser Zuhause', '🏡', 'Schöne Dinge für unseren Lieblingsort.', 'public')
  const item = (title: string, url: string, notes: string, price: number, image_url: string): Wish => ({ id: id(), wishlist_id: birthday.id, title, url, notes, price, image_url, fulfilled: false, created_at: now() })
  return { lists: [birthday, christmas, home], items: [
    item('Ein guter Kaffee am Morgen', 'https://www.bialetti.com/', 'Eine kleine Espressokanne für zwei. Am liebsten der Klassiker in Silber.', 39.90, './illustrations/coffee.svg'),
    item('Mehr Zeit für gute Geschichten', 'https://www.thalia.de/', 'Ein Buch, das du selbst gern gelesen hast. Eine persönliche Empfehlung wäre toll!', 22, './illustrations/books.svg'),
    item('Musik für unterwegs', 'https://www.marshall.com/', 'Kabellose Kopfhörer, gerne in Braun oder Schwarz.', 99, './illustrations/headphones.svg'),
  ] }
}

function loadDemo(): DemoData {
  try {
    const value = localStorage.getItem(STORAGE)
    if (value) {
      const parsed = JSON.parse(value) as DemoData
      if (Array.isArray(parsed.lists) && Array.isArray(parsed.items)) return parsed
    }
  } catch { /* A fresh demo is safe when storage is unavailable or outdated. */ }
  return seed()
}

export function demoRepository(): Repository {
  const data = loadDemo()
  const persist = () => { localStorage.setItem(STORAGE, JSON.stringify(data)) }
  persist()
  return {
    lists: async () => structuredClone(data.lists),
    items: async listId => structuredClone(data.items.filter(item => item.wishlist_id === listId)),
    createList: async input => { const list: Wishlist = { ...input, id: id(), owner_id: 'demo', share_token: id() + id().replaceAll('-', ''), created_at: now() }; data.lists.push(list); persist(); return structuredClone(list) },
    updateList: async (listId, input) => { Object.assign(data.lists.find(list => list.id === listId)!, input); persist() },
    deleteList: async listId => { data.lists = data.lists.filter(list => list.id !== listId); data.items = data.items.filter(item => item.wishlist_id !== listId); persist() },
    rotateLink: async listId => { const token = id() + id().replaceAll('-', ''); data.lists.find(list => list.id === listId)!.share_token = token; persist(); return token },
    saveItem: async (listId, input, itemId) => {
      if (itemId) Object.assign(data.items.find(item => item.id === itemId)!, input)
      else data.items.push({ ...input, id: id(), wishlist_id: listId, fulfilled: false, created_at: now() })
      persist()
    },
    deleteItem: async itemId => { data.items = data.items.filter(item => item.id !== itemId); persist() },
    fulfillItem: async (itemId, fulfilled) => { data.items.find(item => item.id === itemId)!.fulfilled = fulfilled; persist() },
    preview: async (url, signal) => {
      if (!import.meta.env.DEV) throw new Error('Automatische Shop-Vorschauen benötigen die Online-Einrichtung. Bitte gib den Titel manuell ein.')
      const response = await fetch(`${import.meta.env.BASE_URL}__api/link-preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data || typeof data.title !== 'string') throw new Error(data?.error || 'Der Titel konnte nicht geladen werden. Bitte gib ihn manuell ein.')
      return data as Preview
    },
    shared: async () => { throw new Error('Diese Demo speichert nur auf deinem Gerät. Geräteübergreifendes Teilen ist nach der Supabase-Einrichtung verfügbar.') },
  }
}

export function cloudRepository(userId: string): Repository {
  const db = supabase!
  return {
    lists: async () => { const { data, error } = await db.from('wishlists').select('*').eq('owner_id', userId).order('created_at'); if (error) throw error; return data as Wishlist[] },
    items: async listId => { const { data, error } = await db.from('wishes').select('*').eq('wishlist_id', listId).order('created_at'); if (error) throw error; return data as Wish[] },
    createList: async input => { const { data, error } = await db.from('wishlists').insert({ ...input, owner_id: userId }).select().single(); if (error) throw error; return data as Wishlist },
    updateList: async (listId, input) => { const { error } = await db.from('wishlists').update(input).eq('id', listId).eq('owner_id', userId); if (error) throw error },
    deleteList: async listId => { const { error } = await db.from('wishlists').delete().eq('id', listId).eq('owner_id', userId); if (error) throw error },
    rotateLink: async listId => { const { data, error } = await db.rpc('rotate_share_token', { list_id: listId }); if (error) throw error; return data as string },
    saveItem: async (listId, input, itemId) => {
      const result = itemId ? await db.from('wishes').update(input).eq('id', itemId).eq('wishlist_id', listId) : await db.from('wishes').insert({ ...input, wishlist_id: listId })
      if (result.error) throw result.error
    },
    deleteItem: async itemId => { const { error } = await db.from('wishes').delete().eq('id', itemId); if (error) throw error },
    fulfillItem: async (itemId, fulfilled) => { const { error } = await db.from('wishes').update({ fulfilled }).eq('id', itemId); if (error) throw error },
    preview: async (url, signal) => { const { data, error } = await db.functions.invoke('link-preview', { body: { url }, signal }); if (error) throw new Error('Dieser Shop liefert gerade keine Vorschau. Bitte gib den Titel manuell ein.'); return data as Preview },
    shared: async (kind, value) => {
      if (kind === 'token') {
        const { data, error } = await db.rpc('get_shared_wishlist', { token: value })
        if (error) throw error
        if (!data) throw new Error('Diese Liste ist privat, wurde gelöscht oder der Link wurde erneuert.')
        return data as SharedList
      }
      const { data: list, error } = await db.from('wishlists').select('*').eq('id', value).eq('visibility', 'public').maybeSingle()
      if (error) throw error
      if (!list) throw new Error('Diese Liste ist nicht öffentlich oder wurde gelöscht.')
      const { data: items, error: itemError } = await db.from('wishes').select('*').eq('wishlist_id', list.id).order('created_at')
      if (itemError) throw itemError
      return { list: list as Wishlist, items: items as Wish[] }
    },
  }
}
