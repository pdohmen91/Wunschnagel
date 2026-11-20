import { useCallback, useEffect, useState } from 'react'
import type { SetStateAction } from 'react'

const storageKey = (account: string) => `wunschnagel-selected-list:${account}`

export function useListSelection(account: string | null) {
  const [selection, setSelection] = useState<{ account: string | null; id: string | null }>({ account: null, id: null })
  const selectedId = selection.account === account ? selection.id : null
  const setSelectedId = useCallback((value: SetStateAction<string | null>) => {
    setSelection(current => ({
      account,
      id: typeof value === 'function' ? value(current.account === account ? current.id : null) : value,
    }))
  }, [account])

  const restoreSelection = useCallback((lists: { id: string }[]) => {
    let remembered: string | null = null
    try { if (account) remembered = localStorage.getItem(storageKey(account)) } catch { /* Storage is optional. */ }
    setSelectedId(current => [current, remembered].find(id => id && lists.some(list => list.id === id)) || lists[0]?.id || null)
  }, [account, setSelectedId])

  useEffect(() => {
    if (!account || !selectedId) return
    try { localStorage.setItem(storageKey(account), selectedId) } catch { /* List navigation still works without storage. */ }
  }, [account, selectedId])

  return { selectedId, setSelectedId, restoreSelection }
}
