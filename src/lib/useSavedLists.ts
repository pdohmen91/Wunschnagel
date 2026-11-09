import { useCallback, useEffect, useRef, useState } from 'react'
import type { ShareRoute, Wishlist } from '../domain'
import { supabase } from './client'
import { readSavedLists, savedList, SAVED_LISTS_KEY, validSavedList, writeSavedLists } from './savedLists'
import type { SavedList, SavedListEntry } from './savedLists'

export function useSavedLists(userId: string | undefined, ready: boolean) {
  const [device, setDevice] = useState<SavedList[]>(readSavedLists)
  const [cloud, setCloud] = useState<{ owner?: string; entries: SavedList[]; loading: boolean; error: string }>({ entries: [], loading: false, error: '' })
  const identity = useRef(userId); identity.current = userId
  const generation = useRef(0)
  const account = userId && cloud.owner === userId ? cloud.entries : []
  const refresh = useCallback(async () => {
    const request = ++generation.current
    setDevice(readSavedLists())
    if (!userId || !supabase || !ready) { setCloud({ entries: [], loading: false, error: '' }); return }
    setCloud(current => ({ owner: userId, entries: current.owner === userId ? current.entries : [], loading: true, error: '' }))
    try {
      const { data, error } = await supabase.rpc('get_wishlist_bookmarks', { expected_user: userId })
      if (identity.current !== userId || request !== generation.current) return
      if (error) throw error
      setCloud({ owner: userId, entries: Array.isArray(data) ? data.filter(validSavedList) : [], loading: false, error: '' })
    } catch {
      if (identity.current === userId && request === generation.current) setCloud(current => ({ ...current, loading: false, error: 'Gemerkte Listen aus deinem Konto konnten nicht geladen werden.' }))
    }
  }, [userId, ready])
  useEffect(() => { void refresh(); return () => { generation.current++ } }, [refresh])
  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === SAVED_LISTS_KEY || event.key === null) setDevice(readSavedLists()) }
    const onFocus = () => { if (document.visibilityState !== 'hidden') void refresh() }
    window.addEventListener('storage', onStorage); window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus)
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  }, [refresh])
  function removeDevice(id: string) {
    const next = readSavedLists().filter(row => row.list_id !== id)
    writeSavedLists(next); setDevice(next)
  }
  async function remember(list: Pick<Wishlist, 'id' | 'title' | 'emoji'>, route: ShareRoute) {
    const snapshot = savedList(list, route)
    if (!userId || !supabase) {
      const next = [snapshot, ...readSavedLists().filter(row => row.list_id !== list.id)]
      writeSavedLists(next); setDevice(next); return 'device' as const
    }
    const expected = userId
    const { data, error } = await supabase.rpc('save_wishlist_bookmark', { bookmark_kind: snapshot.kind, bookmark_value: snapshot.value, expected_user: expected })
    if (error) throw error
    if (identity.current !== expected) throw new Error('Dein Konto hat sich geändert. Bitte versuche es erneut.')
    if (!validSavedList(data)) throw new Error('Die Liste konnte nicht gemerkt werden. Bitte versuche es erneut.')
    generation.current++
    setCloud(current => ({ owner: expected, entries: [data, ...(current.owner === expected ? current.entries.filter(row => row.list_id !== list.id) : [])], loading: false, error: '' }))
    // Device bookmarks are uploaded only by this explicit user action.
    try { removeDevice(list.id) } catch { /* Account save succeeded; don't report a false failure. */ }
    return 'account' as const
  }
  async function remove(entry: SavedListEntry) {
    // Remove a duplicate local reference first, so it cannot unexpectedly
    // reappear after the account bookmark is deleted.
    if (readSavedLists().some(row => row.list_id === entry.list_id)) removeDevice(entry.list_id)
    if (entry.storage === 'device') return
    if (!userId || !supabase) throw new Error('Bitte melde dich erneut an.')
    const expected = userId
    const { error } = await supabase.rpc('delete_wishlist_bookmark', { bookmark_list_id: entry.list_id, expected_user: expected })
    if (error) throw error
    if (identity.current !== expected) return
    generation.current++
    setCloud(current => current.owner === expected ? { ...current, loading: false, entries: current.entries.filter(row => row.list_id !== entry.list_id) } : current)
  }
  const accountIds = new Set(account.map(row => row.list_id))
  const entries: SavedListEntry[] = [...account.map(row => ({ ...row, storage: 'account' as const })), ...device.filter(row => !accountIds.has(row.list_id)).map(row => ({ ...row, storage: 'device' as const }))]
  return { entries, account, device, remember, remove, refresh, loading: !!userId && (!ready || cloud.owner !== userId || cloud.loading), error: userId && cloud.owner === userId ? cloud.error : '' }
}
export type SavedListsController = ReturnType<typeof useSavedLists>
