import { useEffect, useState } from 'react'
import { Bookmark, Check, ChevronDown, ChevronRight, LoaderCircle, Trash2 } from 'lucide-react'
import type { ShareRoute, Wishlist } from '../domain'
import { visibilityLabels } from '../domain'
import type { Repository } from './repository'
import { savedListUrl } from './savedLists'
import type { SavedList } from './savedLists'
import type { SavedListsController } from './useSavedLists'

const errorText = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Das hat gerade nicht geklappt. Bitte versuche es erneut.'

export function SavedListsMenu({ saved, route, onOpen, onManage }: {
  saved: SavedListsController; route: ShareRoute | null; onOpen: (url: string) => void; onManage: () => void;
}) {
  return <details className="saved-library-menu">
    <summary className="new-list saved-library-trigger"><Bookmark size={17} /><span>Gemerkte Listen</span><span className="count">{saved.entries.length}</span><ChevronDown size={15} className="saved-menu-chevron" aria-hidden="true" /></summary>
    <nav className="saved-menu-options" aria-label="Gemerkte Wunschlisten">
      {saved.loading && <p className="saved-menu-hint" role="status">Gemerkte Listen werden geladen …</p>}
      {saved.error && <div className="saved-menu-hint" role="alert"><p>{saved.error}</p><button className="text-button" onClick={() => void saved.refresh()}>Erneut versuchen</button></div>}
      {saved.entries.map(entry => <a key={entry.list_id} className="saved-menu-entry" href={savedListUrl(entry, window.location.href)} aria-current={route?.kind === entry.kind && route.value === entry.value ? 'page' : undefined}
        onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpen(event.currentTarget.href) }}>
        <span className="saved-menu-emoji" aria-hidden="true">{entry.emoji}</span>
        <span className="saved-menu-details"><strong>{entry.owner_name ? `Von ${entry.owner_name}` : entry.title}</strong><small>{entry.owner_name ? entry.title : 'Name nicht verfügbar'}</small>{entry.available === false && <small className="saved-menu-unavailable">Link nicht mehr verfügbar</small>}</span>
      </a>)}
      {!saved.loading && !saved.error && !saved.entries.length && <p className="saved-menu-hint">Noch keine Liste gemerkt. Öffne eine geteilte Liste und tippe auf „Liste merken“.</p>}
      <button className="text-button saved-menu-manage" onClick={onManage}>Merker verwalten</button>
    </nav>
  </details>
}

export function SavedListsPanel({ saved, lists, repo, fetchOwned, userId, selectedId, demo, onOwn, onOpen }: {
  saved: SavedListsController; lists: Wishlist[]; repo: Repository; fetchOwned: boolean; userId?: string;
  selectedId: string | null; demo: boolean; onOwn: (id: string) => Promise<void>; onOpen: (url: string) => Promise<void>;
}) {
  const [own, setOwn] = useState(lists)
  const [loading, setLoading] = useState(fetchOwned)
  const [ownError, setOwnError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  useEffect(() => {
    let active = true
    if (!fetchOwned) { setOwn(lists); setLoading(false); return }
    setLoading(true)
    repo.lists().then(rows => { if (active) setOwn(rows) }).catch(() => { if (active) setOwnError('Deine eigenen Listen konnten nicht geladen werden.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [lists, repo, fetchOwned])
  async function remove(entry: SavedList) {
    setBusy(entry.list_id); setError('')
    try {
      await saved.remove(entry)
    } catch (err) { setError(errorText(err)) }
    finally { setBusy('') }
  }
  return <>
    {(loading || own.length > 0 || ownError) && <section className="library-section" aria-label="Eigene und gemeinsame Listen">
      <h3>Eigene & gemeinsame Listen</h3>
      {loading && <p className="library-hint" role="status">Deine Listen werden geladen …</p>}
      {ownError && <p role="alert">{ownError}</p>}
      <div className="list-picker-options">{own.map(list => <button key={list.id} className={selectedId === list.id ? 'selected' : ''} onClick={() => void onOwn(list.id)}><span aria-hidden="true">{list.emoji}</span><span>{list.title}<small>{!demo && list.owner_id !== userId ? 'Gemeinsam · Mitbearbeiter' : visibilityLabels[list.visibility]}</small></span>{selectedId === list.id && <Check size={18} aria-label="Ausgewählt" />}</button>)}</div>
    </section>}
    {userId && <section className="library-section" aria-labelledby="saved-lists-title">
      <h3 id="saved-lists-title"><Bookmark size={17} /> Gemerkte Listen <span className="count">{saved.entries.length}</span></h3>
      <p className="library-hint">Öffne eine geteilte Wunschliste und tippe auf „Liste merken“. So findest du sie hier wieder.</p>
      {saved.loading && <p className="library-hint" role="status">Gemerkte Listen werden geladen …</p>}
      {saved.error && <p className="library-error" role="alert">{saved.error} <button className="text-button" onClick={() => void saved.refresh()}>Erneut versuchen</button></p>}
      <div className="saved-list-options">{saved.entries.map(entry => <article className="saved-list-entry" key={entry.list_id}>
        <div className="saved-list-row">
          <a href={savedListUrl(entry, window.location.href)} className="saved-list-open" onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); void onOpen(event.currentTarget.href) }}>
            <span className="saved-list-emoji" aria-hidden="true">{entry.emoji}</span><span className="saved-list-details">
              <strong>{entry.owner_name ? `Von ${entry.owner_name}` : entry.title}</strong>
              {entry.owner_name ? <span className="saved-list-title">{entry.title}</span> : <small>Name nicht verfügbar</small>}
              {entry.available === false && <small>Link nicht mehr verfügbar</small>}
            </span><ChevronRight size={17} />
          </a>
          <button className="icon-button saved-list-remove" aria-label={`„${entry.title}“${entry.owner_name ? ` von ${entry.owner_name}` : ''} nicht mehr merken`} title="Nur aus gemerkten Listen entfernen" disabled={!!busy} onClick={() => void remove(entry)}>{busy === entry.list_id ? <LoaderCircle size={18} className="spin" /> : <Trash2 size={18} />}</button>
        </div>
      </article>)}</div>
      {!saved.loading && !saved.entries.length && !saved.error && <p className="library-empty">Noch keine Liste festgehalten.</p>}
      {error && <p className="library-error" role="alert">{error}</p>}
      {saved.entries.length > 0 && <p className="library-hint library-footnote">Merken gibt dir keine Bearbeitungsrechte. Das Entfernen hier löscht nur deinen Merker, niemals die Wunschliste.</p>}
    </section>}
  </>
}
