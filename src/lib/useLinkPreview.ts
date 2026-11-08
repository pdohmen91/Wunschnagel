import { useEffect, useState } from 'react'
import { webUrl } from '../domain'
import type { Preview } from '../domain'
import type { Repository } from './repository'

type PreviewState = { url: string; data: Preview | null; status: 'idle' | 'loading' | 'done' | 'error'; hint: string }

export function useLinkPreview(input: string, repo: Pick<Repository, 'preview'>, enabled = true) {
  let url = ''
  try { url = input.trim() ? webUrl(input) : '' } catch { /* Wait until a complete link is entered. */ }
  const [state, setState] = useState<PreviewState>({ url: '', data: null, status: 'idle', hint: '' })
  const [retry, setRetry] = useState({ url: '', count: 0 })
  useEffect(() => {
    if (!url || (!enabled && retry.url !== url)) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setState({ url, data: null, status: 'loading', hint: 'Titel und Bild werden aus dem Shop geladen …' })
      try {
        const data = await repo.preview(url, controller.signal)
        if (controller.signal.aborted) return
        setState({ url, data, status: 'done', hint: data.title || data.image_url ? 'Shop-Daten geladen. Eigene Angaben bleiben erhalten.' : 'Der Shop liefert keine Vorschau. Bitte gib den Titel manuell ein.' })
      } catch (error) {
        if (!controller.signal.aborted) setState({ url, data: null, status: 'error', hint: error instanceof Error ? error.message : 'Der Titel konnte nicht geladen werden. Bitte gib ihn manuell ein.' })
      }
    }, retry.url === url ? 0 : 600)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [url, repo, retry, enabled])
  const current = state.url === url && url ? state : null
  return {
    url,
    data: current?.data ?? null,
    status: current?.status ?? 'idle',
    hint: current?.hint ?? '',
    reload: () => setRetry(current => ({ url, count: current.count + 1 })),
  }
}
