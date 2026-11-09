import { supabase } from './client'
import { PreviewCache, previewRequestError } from './previewCache'
import type { Collaboration, ListInvitation, ListInput, Wishlist, Wish, WishInput, Preview, SharedList } from '../domain'

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
  preview(url: string, signal?: AbortSignal, refresh?: boolean): Promise<Preview>
  shared(kind: 'token' | 'public', value: string): Promise<SharedList>
  collaboration(listId: string): Promise<Collaboration>
  createInvite(listId: string): Promise<void>
  revokeInvite(listId: string): Promise<void>
  invitation(token: string): Promise<ListInvitation>
  acceptInvite(token: string): Promise<string>
  removeMember(listId: string, memberId: string): Promise<void>
  leaveList(listId: string): Promise<void>
}

const now = () => new Date().toISOString()
const id = () => crypto.randomUUID()
// Keep the historical key so saved demo lists survive the app/repository rename.
const STORAGE = 'herzenswuensche-demo-v1'

type DemoData = { lists: Wishlist[]; items: Wish[] }
function seed(): DemoData {
  const list = (title: string, emoji: string, description: string, visibility: Wishlist['visibility']): Wishlist => ({ id: id(), owner_id: 'demo', title, emoji, description, visibility, share_token: id() + id().replaceAll('-', ''), created_at: now() })
  const birthday = list('Kleine & große Wünsche', '🌿', 'Ein paar Dinge, über die ich mich freuen würde. Das schönste Geschenk ist aber gemeinsame Zeit.', 'link')
  const christmas = list('Für Weihnachten', '🎄', 'Für gemütliche Tage und kleine Überraschungen.', 'private')
  const home = list('Unser Zuhause', '🏡', 'Schöne Dinge für unseren Lieblingsort.', 'public')
  const item = (title: string, url: string, notes: string, price: number, image_url: string, search_term: string): Wish => ({ id: id(), wishlist_id: birthday.id, title, url, notes, price, image_url, offer_source: 'idealo', search_term, search_url: '', fulfilled: false, created_at: now() })
  return { lists: [birthday, christmas, home], items: [
    item('Ein guter Kaffee am Morgen', 'https://www.bialetti.com/', 'Eine kleine Espressokanne für zwei. Am liebsten der Klassiker in Silber.', 39.90, './illustrations/coffee.svg', 'Bialetti Moka Express 2 Tassen'),
    item('Mehr Zeit für gute Geschichten', 'https://www.thalia.de/', 'Ein Buch, das du selbst gern gelesen hast. Eine persönliche Empfehlung wäre toll!', 22, './illustrations/books.svg', 'Buch'),
    item('Musik für unterwegs', 'https://www.marshall.com/', 'Kabellose Kopfhörer, gerne in Braun oder Schwarz.', 99, './illustrations/headphones.svg', 'Marshall Kopfhörer kabellos'),
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
    collaboration: async () => { throw new Error('Gemeinsames Bearbeiten ist in der lokalen Vorschau nicht möglich.') },
    createInvite: async () => { throw new Error('Bitte melde dich zuerst an.') },
    revokeInvite: async () => { throw new Error('Bitte melde dich zuerst an.') },
    invitation: async () => { throw new Error('Einladungen benötigen die Online-Version.') },
    acceptInvite: async () => { throw new Error('Bitte melde dich zuerst an.') },
    removeMember: async () => { throw new Error('Bitte melde dich zuerst an.') },
    leaveList: async () => { throw new Error('Bitte melde dich zuerst an.') },
  }
}

export function cloudRepository(userId: string): Repository {
  const db = supabase!
  const previews = new PreviewCache()
  return {
    lists: async () => { const { data, error } = await db.rpc('get_my_wishlists'); if (error) throw error; return data as Wishlist[] },
    items: async listId => { const { data, error } = await db.from('wishes').select('*').eq('wishlist_id', listId).order('created_at'); if (error) throw error; return data as Wish[] },
    createList: async input => { const { data, error } = await db.from('wishlists').insert({ ...input, owner_id: userId }).select().single(); if (error) throw error; return data as Wishlist },
    updateList: async (listId, input) => { const { error } = await db.from('wishlists').update(input).eq('id', listId).eq('owner_id', userId); if (error) throw error },
    deleteList: async listId => { const { error } = await db.from('wishlists').delete().eq('id', listId).eq('owner_id', userId); if (error) throw error },
    rotateLink: async listId => { const { data, error } = await db.rpc('rotate_share_token', { list_id: listId }); if (error) throw error; return data as string },
    saveItem: async (listId, input, itemId) => {
      const result = itemId ? await db.from('wishes').update(input).eq('id', itemId).eq('wishlist_id', listId).select('id').single() : await db.from('wishes').insert({ ...input, wishlist_id: listId })
      if (result.error) throw result.error
    },
    deleteItem: async itemId => { const { error } = await db.from('wishes').delete().eq('id', itemId).select('id').single(); if (error) throw error },
    fulfillItem: async (itemId, fulfilled) => { const { error } = await db.from('wishes').update({ fulfilled }).eq('id', itemId).select('id').single(); if (error) throw error },
    preview: async (url, signal, refresh = false) => {
      signal?.throwIfAborted()
      if (refresh) previews.invalidate(url)
      const cached = !refresh && previews.get(url)
      if (cached) return cached
      const { data, error } = await db.functions.invoke('link-preview', { body: { url }, signal })
      if (error) throw await previewRequestError(error)
      if (!data || typeof data.title !== 'string' || typeof data.image_url !== 'string') throw new Error('Der Shop hat keine verwendbaren Produktdaten geliefert. Bitte ergänze Titel und Bild selbst.')
      previews.put(url, data as Preview)
      return data as Preview
    },
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
    collaboration: async listId => { const { data, error } = await db.rpc('get_collaboration', { list_id: listId }); if (error) throw error; return data as Collaboration },
    createInvite: async listId => { const { error } = await db.rpc('create_wishlist_invite', { list_id: listId }); if (error) throw error },
    revokeInvite: async listId => { const { error } = await db.rpc('revoke_wishlist_invite', { list_id: listId }); if (error) throw error },
    invitation: async token => {
      const { data, error } = await db.rpc('get_wishlist_invite', { invite_token: token })
      if (error) throw error
      if (!data) throw new Error('Diese Einladung ist abgelaufen oder wurde deaktiviert. Bitte frage nach einem neuen Link.')
      return data as ListInvitation
    },
    acceptInvite: async token => { const { data, error } = await db.rpc('accept_wishlist_invite', { invite_token: token }); if (error) throw error; return data as string },
    removeMember: async (listId, memberId) => { const { error } = await db.rpc('remove_wishlist_member', { list_id: listId, member_id: memberId }); if (error) throw error },
    leaveList: async listId => { const { error } = await db.rpc('leave_wishlist', { list_id: listId }); if (error) throw error },
  }
}
