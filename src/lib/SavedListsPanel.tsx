import { useEffect, useState } from 'react'
import { Bookmark, Check, ChevronRight, LoaderCircle, Trash2, Upload } from 'lucide-react'
import type { Wishlist } from '../domain'
import { visibilityLabels } from '../domain'
import type { Repository } from './repository'
import { savedListUrl } from './savedLists'
import type { SavedListEntry } from './savedLists'
import type { SavedListsController } from './useSavedLists'

const errorText = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Das hat gerade nicht geklappt. Bitte versuche es erneut.'

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
  async function change(entry: SavedListEntry, adopt: boolean) {
    setBusy(entry.list_id); setError('')
    try {
      if (adopt) await saved.remember({ id: entry.list_id, title: entry.title, emoji: entry.emoji }, entry)
      else await saved.remove(entry)
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
    <section className="library-section" aria-labelledby="saved-lists-title">
      <h3 id="saved-lists-title"><Bookmark size={17} /> Gemerkte Listen <span className="count">{saved.entries.length}</span></h3>
      <p className="library-hint">Öffne eine geteilte Wunschliste und tippe auf „Liste merken“. So findest du sie hier wieder.</p>
      {!userId && <p className="library-hint">Ohne Anmeldung bleiben Merker in diesem Browser bzw. dieser App. Mit Konto findest du sie auch auf anderen Geräten.</p>}
      {saved.loading && <p className="library-hint" role="status">Gemerkte Listen werden geladen …</p>}
      {saved.error && <p className="library-error" role="alert">{saved.error} <button className="text-button" onClick={() => void saved.refresh()}>Erneut versuchen</button></p>}
      <div className="saved-list-options">{saved.entries.map(entry => <article className="saved-list-entry" key={entry.list_id}>
        <div className="saved-list-row">
          <a href={savedListUrl(entry, window.location.href)} className="saved-list-open" onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); void onOpen(event.currentTarget.href) }}>
            <span className="saved-list-emoji" aria-hidden="true">{entry.emoji}</span><span><strong>{entry.title}</strong><small>{entry.available === false ? 'Link nicht mehr verfügbar' : entry.storage === 'account' ? 'In deinem Konto' : 'Auf diesem Gerät'}</small></span><ChevronRight size={17} />
          </a>
          <button className="icon-button saved-list-remove" aria-label={`„${entry.title}“ nicht mehr merken`} title="Nur aus gemerkten Listen entfernen" disabled={!!busy} onClick={() => void change(entry, false)}>{busy === entry.list_id ? <LoaderCircle size={18} className="spin" /> : <Trash2 size={18} />}</button>
        </div>
        {userId && entry.storage === 'device' && <button className="text-button saved-list-adopt" disabled={!!busy} onClick={() => void change(entry, true)}><Upload size={15} /> Ins Konto übernehmen</button>}
      </article>)}</div>
      {!saved.loading && !saved.entries.length && !saved.error && <p className="library-empty">Noch keine Liste festgehalten.</p>}
      {error && <p className="library-error" role="alert">{error}</p>}
      {saved.entries.length > 0 && <p className="library-hint library-footnote">Merken gibt dir keine Bearbeitungsrechte. Das Entfernen hier löscht nur deinen Merker, niemals die Wunschliste.</p>}
    </section>
  </>
}
