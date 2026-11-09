import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, FormEvent, KeyboardEvent, ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCheck, ChevronDown, Copy, ExternalLink, Gift, Globe2, CircleHelp, Info, Link2, LoaderCircle, LockKeyhole, LogIn, LogOut, Pencil, Plus, RotateCcw, Search, Share2, Trash2, WifiOff, X } from 'lucide-react'
import { hostname, offerSearch, offerSources, parsePrice, readShareRoute, sharedProduct, shareUrl, sortWishes, visibilityDescriptions, visibilityLabels, webUrl } from './domain'
import type { ListInput, OfferSource, Visibility, Wish, Wishlist, WishInput, WishSort } from './domain'
import { supabase } from './lib/client'
import { cloudRepository, demoRepository } from './lib/repository'
import type { Repository } from './lib/repository'
import { useLinkPreview } from './lib/useLinkPreview'
import { animate, closeDetails, dialogOpener, dismissDialog, useCardMotion, useHeightMotion } from './lib/motion'
import { useCompactLayout } from './lib/useCompactLayout'
import { useInstallPrompt } from './lib/useInstallPrompt'
import { FormFields } from './lib/FormFields'

const money = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
const message = (error: unknown) => error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Das hat gerade nicht geklappt. Bitte versuche es erneut.'
const PrivacyIcon = ({ value, size = 14 }: { value: Visibility; size?: number }) => value === 'private' ? <LockKeyhole size={size} /> : value === 'public' ? <Globe2 size={size} /> : <Link2 size={size} />

export default function App() {
  const compact = useCompactLayout()
  const installation = useInstallPrompt()
  const iosWebApp = 'standalone' in navigator && navigator.standalone === true
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [demo, setDemo] = useState(!supabase)
  const [hash, setHash] = useState(window.location.hash)
  const route = useMemo(() => readShareRoute(hash), [hash])
  const [lists, setLists] = useState<Wishlist[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sharedList, setSharedList] = useState<Wishlist | null>(null)
  const [items, setItems] = useState<Wish[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all')
  const [sort, setSort] = useState<WishSort>('added')
  const [modal, setModal] = useState<'list' | 'edit-list' | 'item' | 'share' | 'install' | 'help' | 'lists' | 'info' | 'tools' | 'preview' | null>(null)
  const [editItem, setEditItem] = useState<Wish | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'item' | 'list'; id: string; title: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const requestId = useRef(0)
  const activeList = useRef(selectedId)
  activeList.current = selectedId
  const repo = useMemo(() => demo ? demoRepository() : cloudRepository(user?.id || ''), [demo, user?.id])
  const selected = route ? sharedList : lists.find(list => list.id === selectedId) || null
  const canEdit = !route && (demo || !!user)

  useEffect(() => {
    const onHash = () => { setHash(window.location.hash); setError('') }
    const onOnline = () => setOnline(navigator.onLine)
    const closeMenus = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('.card-menu')) {
        document.querySelectorAll<HTMLDetailsElement>('.card-menu[open]').forEach(menu => { void closeDetails(menu) })
      }
    }
    document.addEventListener('pointerdown', closeMenus)
    window.addEventListener('hashchange', onHash)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOnline)
    return () => { document.removeEventListener('pointerdown', closeMenus); window.removeEventListener('hashchange', onHash); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOnline) }
  }, [])

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(message(sessionError))
      setUser(data.session?.user || null)
      setAuthReady(true)
    }).catch(e => { if (active) { setError(message(e)); setAuthReady(true) } })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session) setDemo(false)
      setAuthReady(true)
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 6000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const reloadLists = useCallback(async () => {
    const next = await repo.lists()
    setLists(next)
    setSelectedId(current => next.some(list => list.id === current) ? current : next[0]?.id || null)
    return next
  }, [repo])

  useEffect(() => {
    if (route || (!demo && !user)) { setLists([]); return }
    let active = true
    setLoading(true)
    setError('')
    repo.lists().then(next => {
      if (!active) return
      setLists(next)
      setSelectedId(current => next.some(list => list.id === current) ? current : next[0]?.id || null)
      setLoading(false)
    }).catch(e => { if (active) { setError(message(e)); setLoading(false) } })
    return () => { active = false }
  }, [repo, demo, user, route])

  useEffect(() => {
    const current = ++requestId.current
    setItems([])
    setError('')
    if (route) {
      setLoading(true)
      setSharedList(null)
      if (!supabase) { setError('Gemeinsame Listen sind in dieser lokalen Vorschau noch nicht verfügbar. Du kannst hier eigene Listen und Wünsche ausprobieren.'); setLoading(false); return }
      cloudRepository('').shared(route.kind, route.value).then(data => {
        if (requestId.current !== current) return
        setSharedList(data.list)
        setItems(data.items)
      }).catch(e => { if (requestId.current === current) setError(message(e)) }).finally(() => { if (requestId.current === current) setLoading(false) })
      return
    }
    if (!selectedId || (!demo && !user)) { setLoading(false); return }
    setLoading(true)
    repo.items(selectedId).then(data => { if (requestId.current === current) setItems(data) }).catch(e => { if (requestId.current === current) setError(message(e)) }).finally(() => { if (requestId.current === current) setLoading(false) })
    return () => { requestId.current++ }
  }, [repo, selectedId, route, demo, user])

  async function refreshItems(listId: string) {
    const currentRequest = requestId.current
    const data = await repo.items(listId)
    if (activeList.current === listId && requestId.current === currentRequest) setItems(data)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try { await action() } catch (e) { setNotice(message(e)) } finally { setBusy(false) }
  }

  async function signOut() {
    const { error: signOutError } = await supabase!.auth.signOut()
    if (signOutError) throw signOutError
    setSelectedId(null)
    setItems([])
  }

  async function login() {
    const callback = new URL(import.meta.env.BASE_URL, window.location.origin).href
    const { error: authError } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback } })
    if (authError) throw authError
  }

  async function closeModal() {
    await dismissDialog(document.querySelector<HTMLDialogElement>('dialog[open]'))
    setModal(null)
  }

  async function closeDelete() {
    await dismissDialog(document.querySelector<HTMLDialogElement>('dialog[open]'))
    setDeleteTarget(null)
  }

  function openShare() {
    setModal('share')
  }

  const shownItems = sortWishes(items.filter(item => (filter === 'all' || (filter === 'done' ? item.fulfilled : !item.fulfilled)) && `${item.title} ${item.notes} ${hostname(item.url)}`.toLocaleLowerCase('de').includes(query.toLocaleLowerCase('de'))), sort)
  const openItems = items.filter(item => !item.fulfilled)
  const total = openItems.reduce((sum, item) => sum + (item.price || 0), 0)
  const name = user?.user_metadata?.full_name?.split(' ')[0] || 'Du'

  const listActions = canEdit && selected ? <>
    <button className="button secondary" aria-label="Liste teilen" onClick={openShare}><Share2 size={16} /> {compact ? 'Teilen' : 'Liste teilen'}</button>
    <button className="button primary" aria-label="Wunsch hinzufügen" onClick={() => { setEditItem(null); setModal('item') }}><Plus size={18} /> {compact ? 'Wunsch' : 'Wunsch hinzufügen'}</button>
  </> : null

  return <div className="app-shell" data-compact={compact} data-account-actions={!!(user && !demo || demo && supabase)}>
    <aside className="sidebar">
      <a className="brand" href={import.meta.env.BASE_URL} aria-label="Wunschnagel Startseite">
        <span className="brand-icon"><WishMark /></span>
        <span className="brand-wordmark"><strong>Wunschnagel</strong><small>Deine Wünsche. Festgehalten.</small></span>
      </a>
      <div className="sidebar-body">
        <div className="nav-title"><span>{route ? 'Geteilte Liste' : 'Meine Listen'}</span>{!route && <span className="count">{lists.length}</span>}</div>
        {!route && <nav className="list-nav" aria-label="Wunschlisten">
          {lists.map(list => <button key={list.id} className={`list-link ${selectedId === list.id ? 'active' : ''}`} title={list.title} aria-pressed={selectedId === list.id} onClick={() => { setSelectedId(list.id); setQuery(''); setFilter('all') }}>
            <span className="list-emoji">{list.emoji}</span><span>{list.title}</span><PrivacyIcon value={list.visibility} />
          </button>)}
        </nav>}
        {!compact && !route && lists.length > 0 && <label className="mobile-list-picker">Wunschliste<select aria-label="Wunschliste auswählen" value={selectedId || ''} onChange={e => { setSelectedId(e.target.value); setQuery(''); setFilter('all') }}>
          {lists.map(list => <option key={list.id} value={list.id}>{list.emoji} {list.title}</option>)}
        </select></label>}
        {canEdit && !compact && <button className="new-list" onClick={() => setModal('list')}><Plus size={17} /> Neue Wunschliste</button>}
        {route && !compact && <a className="new-list" href={import.meta.env.BASE_URL}><ArrowLeft size={16} /> Meine Listen</a>}
      </div>
      <button className="install-link" onClick={() => setModal('install')}><ArrowDownToLine size={17} /> Auf dem Handy installieren</button>
      <div className="profile">
        <span className="avatar">{demo ? 'D' : name.slice(0, 1)}</span>
        <span><strong>{demo ? 'Lokale Demo' : user ? name : 'Wunschnagel'}</strong><small>{demo ? 'Nur auf diesem Gerät' : user ? 'Dein Konto' : 'Wunschlisten für alle Anlässe'}</small></span>
        {user && !demo && <button className="icon-button" aria-label="Abmelden" disabled={busy} onClick={() => run(signOut)}><LogOut size={17} /></button>}
        {demo && supabase && <button className="icon-button" aria-label="Zur Anmeldung" onClick={() => setDemo(false)}><LogIn size={17} /></button>}
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <span>{route ? 'Geteilte Wunschliste' : 'Meine Wunschlisten'}</span>
        <div>
          {compact && !route && (demo || user) && <button className="mobile-list-trigger" onClick={() => setModal('lists')} aria-haspopup="dialog">Listen <ChevronDown size={16} /></button>}
          {compact && !route && !demo && !user && !installation.installed && !installation.visible && <button className="icon-button mobile-list-trigger" aria-label="App installieren" onClick={() => setModal('install')}><ArrowDownToLine size={18} /></button>}
          {compact && route && <a className="mobile-list-trigger" href={import.meta.env.BASE_URL}>Meine Listen</a>}
          {!compact && <button className="install-topbar" aria-label="App installieren" onClick={() => setModal('install')}><ArrowDownToLine size={18} /><span>App installieren</span></button>}
          {user && !demo && <button className="icon-button mobile-account" aria-label="Abmelden" disabled={busy} onClick={() => run(signOut)}><LogOut size={19} /></button>}
          {demo && supabase && <button className="icon-button mobile-account" aria-label="Zur Anmeldung" onClick={() => setDemo(false)}><LogIn size={19} /></button>}
        </div>
      </header>
      {compact && installation.visible && <div className="app-install-prompt" role="region" aria-label="Wunschnagel als App nutzen">
        <button className="install-prompt-action" onClick={() => setModal('install')} aria-label="App installieren" aria-haspopup="dialog"><ArrowDownToLine size={17} /><span>App installieren</span><small>Direkt vom Startbildschirm öffnen</small><ArrowRight size={15} /></button>
        <button className="icon-button" aria-label="Installationshinweis schließen" onClick={installation.dismiss}><X size={16} /></button>
      </div>}
      {demo && (compact ? <button className="compact-demo" onClick={() => setModal('preview')}><Info size={14} /><span>Vorschau · nur auf diesem Gerät</span><ChevronDown size={14} /></button> : <div className="demo-banner"><Info size={15} /><p><strong>Lokale Vorschau.</strong> Nur in diesem Browser gespeichert. Noch nicht teilbar.</p></div>)}
      {!online && <div className="offline-banner"><WifiOff size={16} /> Du bist offline. Gemeinsame Listen benötigen eine Internetverbindung.</div>}
      <div className="page-content">
        {!authReady ? <Loading /> : !demo && !user && !route ? <section className="welcome">
          <div className="welcome-icon"><WishMark /></div>
          <h1>Deine Wünsche.<br />Festgehalten.</h1>
          <p>Sammle Wünsche und teile sie mit deinen Lieblingsmenschen.</p>
          <button className="button primary" disabled={busy} onClick={() => run(login)}><LogIn size={18} /> Mit Google anmelden</button>
          <button className="text-button" onClick={() => { setDemo(true); setSelectedId(null) }}>Ohne Anmeldung ausprobieren <ArrowUpRight size={15} /></button>
          {error && <p role="alert" className="form-error">{error}</p>}
          <small>{iosWebApp && <>Melde dich einmal direkt in dieser App an. Deine Browser-Anmeldung wird hier nicht übernommen.<br /></>}Private Listen sind nur für dich sichtbar.</small>
        </section> : <>
          {error && <div className="error-panel" role="alert"><Info size={20} /><div><strong>Die Liste konnte nicht geladen werden.</strong><p>{error}</p>{route && !supabase ? <a className="text-button" href={import.meta.env.BASE_URL}>Eigene Wunschlisten ausprobieren <ArrowRight size={15} /></a> : <button className="text-button" onClick={() => window.location.reload()}>Erneut versuchen</button>}</div></div>}
          {selected ? <div className="list-view" key={selected.id}>
            <div className="breadcrumb"><span>{route ? 'Mit dir geteilt' : 'Meine Listen'}</span><span>/</span><strong>{selected.title}</strong></div>
            <section className="list-heading">
              <div>
                <div className="list-eyebrow"><span>{route ? 'Mit dir geteilt' : 'Deine Wunschliste'}</span>{!route && <span>{String(lists.findIndex(list => list.id === selected.id) + 1).padStart(2, '0')} / {String(lists.length).padStart(2, '0')}</span>}</div>
                <div className="list-title-row"><span className="list-cover" aria-hidden="true">{selected.emoji}</span><h1>{selected.title}</h1></div>
                {selected.description && !compact && <p>{selected.description}</p>}
                <div className="list-meta">
                  <span className={`privacy-pill ${selected.visibility}`} title={visibilityDescriptions[selected.visibility]}><PrivacyIcon value={selected.visibility} />{visibilityLabels[selected.visibility]}</span>
                  {!compact && <span>{items.length} {items.length === 1 ? 'Wunsch' : 'Wünsche'}</span>}
                  {compact && <button className="list-info-trigger" onClick={() => setModal('info')}><CircleHelp size={15} /> Details &amp; Hilfe</button>}
                  {canEdit && <button className={`edit-list ${compact ? 'compact-edit-list' : ''}`} aria-label="Liste bearbeiten" onClick={() => setModal('edit-list')}><Pencil size={compact ? 17 : 14} />{!compact && 'Liste bearbeiten'}</button>}
                </div>
              </div>
              {!compact && listActions && <div className="heading-actions">{listActions}</div>}
            </section>
            {!compact && <div className={`usage-guide ${canEdit ? 'own-list-guide' : ''}`}>
              <p>{canEdit ? <>Hier hängen deine Geschenkideen. Über <strong>„Wunsch hinzufügen“</strong> fügst du einen Shop-Link ein.</> : <>Öffne <strong>„Zum Shop“</strong>, um dir ein Geschenk anzusehen. Einkäufe werden hier nicht reserviert.</>}</p>
              <button className="text-button" onClick={() => setModal('help')}><CircleHelp size={17} /> So funktioniert’s</button>
            </div>}
            {!loading && items.length === 0 ? <section className="list-empty">
              <span className="empty-icon"><WishMark /></span>
              <h2>Noch keine Wünsche</h2>
              <p>{canEdit ? 'Der erste Nagel sitzt. Jetzt fehlen nur noch deine Wünsche: Kopiere einen Shop-Link und wähle „Ersten Wunsch hinzufügen“.' : 'An diesem Wunschzettel hängt noch nichts. Die Person hat noch keine Wünsche eingetragen. Schau später noch einmal vorbei.'}</p>
              {canEdit && <button className="button primary" onClick={() => { setEditItem(null); setModal('item') }}><Plus size={18} /> Ersten Wunsch hinzufügen</button>}
            </section> : <>
              {items.length > 0 && <div className="items-toolbar">
                <div className="tabs" role="group" aria-label="Wünsche filtern" aria-describedby="wish-status-help">
                  <button aria-label={`Alle Wünsche ${items.length}`} aria-pressed={filter === 'all'} className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>{compact ? 'Alle' : 'Alle Wünsche'} <span aria-hidden="true" key={items.length}>{items.length}</span></button>
                  <button aria-pressed={filter === 'open'} className={filter === 'open' ? 'selected' : ''} onClick={() => setFilter('open')}>Offen</button>
                  <button aria-pressed={filter === 'done'} className={filter === 'done' ? 'selected' : ''} onClick={() => setFilter('done')}>Erfüllt</button>
                </div>
                {compact ? <button className={`collection-tools-trigger icon-button ${query || sort !== 'added' ? 'is-active' : ''}`} aria-label="Suchen und sortieren" aria-haspopup="dialog" onClick={() => setModal('tools')}><Search size={20} /></button> : <div className="toolbar-controls">
                  <label className="search"><Search size={16} /><input aria-label="Wünsche durchsuchen" placeholder="Wünsche suchen" value={query} onChange={e => setQuery(e.target.value)} />{query && <button className="icon-button" aria-label="Suche zurücksetzen" onClick={() => setQuery('')}><X size={14} /></button>}</label>
                  <label className="sort-control"><span>Sortieren</span><select aria-label="Wünsche sortieren" value={sort} onChange={e => setSort(e.target.value as WishSort)}>
                    <option value="added">Reihenfolge der Liste</option><option value="newest">Neueste zuerst</option><option value="name">Name A–Z</option><option value="price-asc">Preis aufsteigend</option><option value="price-desc">Preis absteigend</option>
                  </select></label>
                </div>}
              </div>}
              {items.length > 0 && <p className={`status-explanation ${compact ? 'screen-reader-only' : ''}`} id="wish-status-help">Offen: noch gewünscht. Erfüllt: schon bekommen.</p>}
              {items.length > 0 && (compact ? <div className={`mobile-result-summary ${!query && filter === 'all' ? 'screen-reader-only' : ''}`}><p role="status">{query || filter !== 'all' ? <>{shownItems.length} von {items.length} Wünschen</> : <>{items.length} {items.length === 1 ? 'Wunsch' : 'Wünsche'}</>}</p>{(query || filter !== 'all') && <button className="text-button" aria-label="Alle Wünsche zeigen" onClick={() => { setQuery(''); setFilter('all') }}>Alle Wünsche <X size={13} /></button>}</div> : (query || filter !== 'all') && <div className="filter-feedback"><p role="status">{shownItems.length} von {items.length} {items.length === 1 ? 'Wunsch' : 'Wünschen'}{query && <> für „{query}“</>}{filter !== 'all' && <> · {filter === 'open' ? 'nur offene' : 'nur erfüllte'}</>}</p>{shownItems.length > 0 && <button className="text-button" onClick={() => { setQuery(''); setFilter('all') }}>Alle Wünsche zeigen</button>}</div>)}
              {loading ? <Loading /> : <WishGrid revision={shownItems.map(item => `${item.id}:${item.fulfilled}`).join('|')}>{shownItems.map(item => <WishCard key={item.id} item={item} number={items.indexOf(item) + 1} canEdit={canEdit} busy={busy} onEdit={() => { setEditItem(item); setModal('item') }} onDelete={() => setDeleteTarget({ kind: 'item', id: item.id, title: item.title })} onFulfill={() => run(async () => { await repo.fulfillItem(item.id, !item.fulfilled); await refreshItems(selected.id); setNotice(item.fulfilled ? 'Wieder offen. Dein Wunsch hängt wieder an der Liste.' : 'Nagel auf den Kopf! Wunsch als erfüllt markiert.') })} />)}</WishGrid>}
              {!loading && !shownItems.length && <div className="empty-state"><Search size={27} /><h3>{query ? 'Noch kein Treffer' : 'Keine Wünsche in diesem Filter'}</h3><p>{query ? 'Noch nicht den Nagel auf den Kopf getroffen? Versuche einen anderen Suchbegriff oder setze die Filter zurück.' : filter === 'done' ? 'Noch nichts abgehakt? Hier hängen später deine erfüllten Wünsche.' : 'Hier ist gerade kein Wunsch mehr offen. Über „Alle“ siehst du auch erfüllte Wünsche.'}</p><button className="button secondary" onClick={() => { setQuery(''); setFilter('all') }}>Filter zurücksetzen</button></div>}
            </>}
            {items.length > 0 && <footer className="list-footer"><span key={`${openItems.length}:${items.length}`}>{openItems.length} offen <span className="meta-dot">·</span> {items.length - openItems.length} erfüllt</span>{total > 0 && <span>Offene Wünsche: ca. {money.format(total)}</span>}</footer>}
          </div> : !loading && !error ? <section className="empty-state first-list"><span className="empty-icon"><WishMark /></span><h1>Deine erste Wunschliste</h1><p>Ein Nagel, ein Zettel, deine Wünsche. Erstelle eine Liste für einen Anlass oder sammle deine Ideen für später.</p>{canEdit && <button className="button primary" onClick={() => setModal('list')}><Plus size={18} /> Wunschliste erstellen</button>}</section> : loading ? <Loading /> : null}
        </>}
      </div>
    </main>

    {modal === 'lists' && <Dialog title="Meine Wunschlisten" onClose={closeModal}>
      <p className="dialog-intro">Alle deine Wunschzettel an einem Platz. Wähle eine Liste oder lege eine neue an.</p>
      {!installation.installed && <button className="button secondary list-install" onClick={async () => { await closeModal(); setModal('install') }}><ArrowDownToLine size={17} /> App installieren <ArrowRight size={15} /></button>}
      <div className="list-picker-options">{lists.map(list => <button key={list.id} className={selectedId === list.id ? 'selected' : ''} onClick={async () => { await closeModal(); setSelectedId(list.id); setQuery(''); setFilter('all') }}><span aria-hidden="true">{list.emoji}</span><span>{list.title}<small>{visibilityLabels[list.visibility]}</small></span>{selectedId === list.id && <Check size={18} aria-label="Ausgewählt" />}</button>)}</div>
      {canEdit && <button className="button primary list-create" onClick={async () => { await closeModal(); setModal('list') }}><Plus size={17} /> Neue Wunschliste</button>}
      <div className="list-picker-footer"><button className="text-button" onClick={async () => { await closeModal(); setModal('help') }}><CircleHelp size={17} /> So funktioniert’s</button></div>
    </Dialog>}
    {modal === 'info' && selected && <Dialog title="Über diese Liste" onClose={closeModal}>
      <p className="info-list-name">{selected.emoji} {selected.title}</p>
      <p className="share-explanation">{selected.description || 'Für diese Liste wurde noch keine Beschreibung ergänzt.'}</p>
      <div className="help-note"><strong>{visibilityLabels[selected.visibility]}</strong><p>{visibilityDescriptions[selected.visibility]}</p></div>
      <div className="dialog-actions"><button className="button secondary" onClick={async () => { await closeModal(); setModal('help') }}><CircleHelp size={16} /> So funktioniert’s</button>{canEdit && <button className="button primary" onClick={async () => { await closeModal(); setModal('edit-list') }}><Pencil size={16} /> Liste bearbeiten</button>}</div>
    </Dialog>}
    {modal === 'preview' && <Dialog title="Lokale Vorschau" onClose={closeModal}><p className="dialog-intro">Probiere Wunschnagel aus: Ändere die Beispielwünsche oder halte nagelneue Ideen auf eigenen Listen fest.</p><div className="help-note"><strong>Nur in diesem Browser gespeichert</strong><p>Deine Änderungen bleiben auf diesem Gerät. Teilen mit anderen ist in dieser Vorschau noch nicht möglich.</p></div><div className="dialog-actions"><button className="button primary" onClick={closeModal}>Verstanden</button></div></Dialog>}
    {modal === 'tools' && <CollectionToolsDialog query={query} sort={sort} onClose={closeModal} onApply={async (nextQuery, nextSort) => { setQuery(nextQuery); setSort(nextSort); await closeModal() }} />}
    {(modal === 'list' || modal === 'edit-list') && <ListDialog list={modal === 'edit-list' ? selected : null} onClose={closeModal} onSave={async input => {
      if (modal === 'edit-list' && selected) await repo.updateList(selected.id, input)
      else { const created = await repo.createList(input); setSelectedId(created.id) }
      await reloadLists(); await closeModal(); setNotice(modal === 'edit-list' ? 'Wunschliste gespeichert. Alles sitzt.' : 'Deine nagelneue Wunschliste ist bereit.')
    }} onDelete={selected && modal === 'edit-list' ? async () => { await closeModal(); setDeleteTarget({ kind: 'list', id: selected.id, title: selected.title }) } : undefined} />}
    {modal === 'item' && selected && <ItemDialog item={editItem} listTitle={selected.title} repo={repo} onClose={closeModal} onSave={async input => { await repo.saveItem(selected.id, input, editItem?.id); if (!editItem) { setQuery(''); setFilter('all') } await refreshItems(selected.id); await closeModal(); setNotice(editItem ? 'Wunsch aktualisiert. Sitzt jetzt genau richtig.' : 'Festgehalten! Dein Wunsch hängt an der Liste.') }} />}
    {modal === 'share' && selected && <ShareDialog demo={demo} list={selected} onClose={closeModal} onUpdate={async input => { await repo.updateList(selected.id, input); await reloadLists() }} onRotate={async () => { await repo.rotateLink(selected.id); await reloadLists() }} />}
    {modal === 'help' && <HelpDialog guest={!!route} demo={demo} onClose={closeModal} />}
    {modal === 'install' && <Dialog title="App auf dem Handy installieren" onClose={closeModal}><p className="dialog-intro">Gib Wunschnagel einen festen Platz auf deinem Startbildschirm. So öffnet sich die Web-App wie eine eigene App.</p><div className="install-step"><span>1</span><div><strong>Auf dem iPhone</strong><p>Öffne die veröffentlichte App in Safari, tippe auf „Teilen“ und dann auf „Zum Home-Bildschirm“.</p><p>Öffne Wunschnagel danach über das neue App-Symbol und melde dich dort einmal an. App und Browser speichern die Anmeldung getrennt. Mit demselben Google-Konto erreichst du in beiden dieselben Listen.</p></div></div><div className="install-step"><span>2</span><div><strong>Auf Android</strong><p>Öffne die veröffentlichte App in Chrome. Wähle im Menü „App installieren“ oder „Zum Startbildschirm hinzufügen“.</p></div></div><div className="hint"><Info size={17} /><span>Für die Installation brauchst du eine HTTPS-Adresse. Gemeinsame Listen und Shop-Vorschauen benötigen Internet.</span></div></Dialog>}
    {deleteTarget && <Dialog title={deleteTarget.kind === 'list' ? 'Wunschliste löschen?' : 'Wunsch löschen?'} onClose={() => { if (!busy) void closeDelete() }}><p className="dialog-intro">„{deleteTarget.title}“ wird gelöscht.{deleteTarget.kind === 'list' && ' Dabei werden auch alle Wünsche in dieser Liste und der geteilte Link entfernt.'}</p><div className="dialog-actions"><button className="button secondary" disabled={busy} onClick={() => void closeDelete()}>Behalten</button><button className="button danger" disabled={busy} onClick={() => run(async () => { if (deleteTarget.kind === 'list') { await repo.deleteList(deleteTarget.id); await reloadLists() } else { await repo.deleteItem(deleteTarget.id); if (selected) await refreshItems(selected.id) } await closeDelete(); setNotice(deleteTarget.kind === 'list' ? 'Wunschliste gelöscht. Platz für nagelneue Ideen.' : 'Wunsch gelöscht. Platz für nagelneue Ideen.') })}>{busy ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />} Löschen</button></div></Dialog>}
    {compact && listActions && createPortal(<nav className="mobile-action-bar" aria-label="Aktionen für die Wunschliste">{listActions}</nav>, document.body)}
    <MotionToast message={notice} onClose={() => setNotice('')} />
  </div>
}

function WishGrid({ children, revision }: { children: ReactNode; revision: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useCardMotion(ref, revision)
  return <div ref={ref} className="wish-grid">{children}</div>
}

function MotionToast({ message, onClose }: { message: string; onClose: () => void }) {
  const [shown, setShown] = useState(message)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (message) { setShown(message); return }
    const exit = animate(ref.current, [{ opacity: 1, transform: 'translate(-50%, 0)' }, { opacity: 0, transform: 'translate(-50%, 10px)' }], 160)
    const clear = () => setShown('')
    if (!exit) { clear(); return }
    let current = true
    void exit.finished.then(() => { if (current) clear() }, () => { if (current) clear() })
    return () => { current = false; exit.cancel() }
  }, [message])
  return shown ? createPortal(<div ref={ref} key={shown} className="toast" role="status" aria-hidden={!message || undefined}><Info size={19} /><span>{shown}</span><button className="icon-button" aria-label="Hinweis schließen" onClick={onClose}><X size={16} /></button><span className="toast-lifetime" aria-hidden="true" /></div>, document.body) : null
}

function Loading() { return <div className="loading" role="status"><LoaderCircle className="spin" size={24} /><span>Deine Wünsche werden geladen …</span></div> }

function WishMark() {
  return <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M8 10h19l7 8v19H8z" stroke="currentColor" strokeWidth="2" /><path d="M27 10v8h7M8 32h26" stroke="currentColor" strokeWidth="2" /><path d="M21 29s-7-4.2-7-8a3.5 3.5 0 0 1 7-1 3.5 3.5 0 0 1 7 1c0 3.8-7 8-7 8Z" fill="currentColor" /><path d="M20 3v12m-4-12h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
}

function WishCard({ item, number, canEdit, busy, onEdit, onDelete, onFulfill }: { item: Wish; number: number; canEdit: boolean; busy: boolean; onEdit: () => void; onDelete: () => void; onFulfill: () => void }) {
  const offers = offerSearch(item)
  const [imageFailed, setImageFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [notesOverflow, setNotesOverflow] = useState(false)
  const notesRef = useRef<HTMLParagraphElement>(null)
  const [celebrate, setCelebrate] = useState(false)
  const wasFulfilled = useRef(item.fulfilled)
  useHeightMotion(notesRef, expanded)
  useEffect(() => {
    const newlyFulfilled = item.fulfilled && !wasFulfilled.current
    wasFulfilled.current = item.fulfilled
    if (!newlyFulfilled) { setCelebrate(false); return }
    setCelebrate(true)
    const timer = window.setTimeout(() => setCelebrate(false), 750)
    return () => window.clearTimeout(timer)
  }, [item.fulfilled])
  useEffect(() => setImageFailed(false), [item.image_url])
  useEffect(() => {
    const node = notesRef.current
    if (!node || expanded) return
    const measure = () => setNotesOverflow(node.scrollHeight > node.clientHeight + 1)
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    return () => observer.disconnect()
  }, [item.notes, expanded])
  return <article data-wish-id={item.id} className={`wish-card ${item.fulfilled ? 'fulfilled' : ''} ${celebrate ? 'just-fulfilled' : ''}`}>
    <div className="wish-image">
      <span className="wish-number" aria-hidden="true">{String(number).padStart(2, '0')}</span>
      <a className="wish-image-link" href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Zum Shop: ${item.title}`}>
        {item.image_url && !imageFailed ? <img src={item.image_url} alt={item.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} /> : <div className="image-placeholder"><Gift size={48} strokeWidth={1.1} /><span>{imageFailed ? 'Bild nicht erreichbar' : 'Kein Bild hinterlegt'}</span></div>}
      </a>
      {celebrate && <span className="completion-burst" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} style={{ '--burst-angle': `${index * 45}deg` } as CSSProperties} />)}</span>}
      {item.fulfilled && <span className="fulfilled-badge"><Check size={13} /> Erfüllt</span>}
    </div>
    <div className="wish-body">
      <span className="shop-name"><span className="shop-dot" />{hostname(item.url)}<ArrowUpRight size={12} /></span>
      <h2>{item.title}</h2>
      <p ref={notesRef} id={`notes-${item.id}`} className={`wish-notes ${!item.notes ? 'empty-notes' : ''} ${expanded ? 'expanded' : ''}`}>{item.notes || 'Keine zusätzlichen Hinweise.'}</p>
      {(notesOverflow || expanded) && <button className="notes-toggle" aria-expanded={expanded} aria-controls={`notes-${item.id}`} onClick={() => setExpanded(!expanded)}>{expanded ? 'Weniger anzeigen' : 'Alle Hinweise lesen'}<ChevronDown size={14} /></button>}
      <div className="wish-bottom">
        <span className={`price ${item.price === null ? 'empty-price' : ''}`}>{item.price !== null ? money.format(item.price) : 'Kein Preis angegeben'}{item.price !== null && <small>ca.</small>}</span>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="shop-link">Zum Shop <ExternalLink size={13} /></a>
        {offers.url && <a className="offer-search-link" href={offers.url} target="_blank" rel="noopener noreferrer" aria-label={`${offers.label} bei ${offers.provider} für ${item.title}`} title={`${offers.provider}: ${offers.term}`}><Search size={15} /><span>{offers.label}</span><ArrowUpRight size={14} /></a>}
      </div>
    </div>
    {canEdit && <details className="card-menu" name="wish-actions" onKeyDown={e => { if (e.key === 'Escape') { void closeDetails(e.currentTarget); e.currentTarget.querySelector('summary')?.focus() } }}>
      <summary aria-label={`Optionen für ${item.title}`}><Pencil size={13} /><span>Bearbeiten</span></summary>
      <div onClick={e => { const details = e.currentTarget.closest('details'); if (details) void closeDetails(details) }}>
        <p className="menu-help">{item.fulfilled ? 'Wünschst du es dir wieder? Wähle „Wieder offen“.' : 'Schon bekommen? Wähle „Als erfüllt markieren“.'}</p>
        <button onClick={onEdit}><Pencil size={14} /> Bearbeiten</button>
        <button disabled={busy} onClick={onFulfill}><CheckCheck size={14} />{item.fulfilled ? 'Wieder offen' : 'Als erfüllt markieren'}</button>
        <button className="danger-text" disabled={busy} onClick={onDelete}><Trash2 size={14} /> Löschen</button>
      </div>
    </details>}
  </article>
}

function Dialog({ title, children, onClose, formLayout = false }: { title: string; children: ReactNode; onClose: () => void; formLayout?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const returnFocus = useRef(dialogOpener())
  function keepFocusInside(event: KeyboardEvent<HTMLDialogElement>) {
    if (ref.current?.dataset.closing) { event.preventDefault(); return }
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select, summary, [tabindex]'))
      .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && node.checkVisibility())
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }
  useEffect(() => {
    const dialog = ref.current
    const trigger = returnFocus.current
    if (dialog) delete dialog.dataset.closing
    dialog?.showModal()
    dialog?.querySelector<HTMLElement>('input, textarea, select')?.focus()
    return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus() }
  }, [])
  return <dialog ref={ref} className={`dialog ${formLayout ? 'dialog-form' : ''}`} aria-labelledby="dialog-title" onKeyDown={keepFocusInside} onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === ref.current) { const box = ref.current.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) onClose() } }}><div className="dialog-heading"><h2 id="dialog-title">{title}</h2><button className="icon-button" aria-label="Schließen" onClick={onClose}><X size={21} /></button></div>{children}</dialog>
}

function CollectionToolsDialog({ query, sort, onClose, onApply }: { query: string; sort: WishSort; onClose: () => void; onApply: (query: string, sort: WishSort) => Promise<void> }) {
  const [draftQuery, setDraftQuery] = useState(query)
  const [draftSort, setDraftSort] = useState(sort)
  return <Dialog formLayout title="Suchen & sortieren" onClose={onClose}>
    <p className="dialog-intro">Finde genau den Wunsch, der den Nagel auf den Kopf trifft. Suche nach Name, Shop oder Hinweis und sortiere deine Liste.</p>
    <form onSubmit={event => { event.preventDefault(); void onApply(draftQuery, draftSort) }}>
      <FormFields><fieldset>
        <label className="field">Wünsche durchsuchen<input autoFocus aria-label="Wünsche durchsuchen" value={draftQuery} onChange={event => setDraftQuery(event.target.value)} placeholder="Name, Shop oder Hinweis" inputMode="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" /></label>
        <label className="field">Sortierung<span className="select-wrapper"><select aria-label="Wünsche sortieren" value={draftSort} onChange={event => setDraftSort(event.target.value as WishSort)}><option value="added">Reihenfolge der Liste</option><option value="newest">Neueste zuerst</option><option value="name">Name A–Z</option><option value="price-asc">Preis aufsteigend</option><option value="price-desc">Preis absteigend</option></select><ChevronDown size={16} /></span></label>
        <button type="button" className="text-button" onClick={() => { setDraftQuery(''); setDraftSort('added') }}><RotateCcw size={15} /> Suche und Sortierung zurücksetzen</button>
      </fieldset></FormFields>
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>Abbrechen</button><button className="button primary"><Search size={16} /> Ergebnisse anzeigen</button></div>
    </form>
  </Dialog>
}

function HelpDialog({ guest, demo, onClose }: { guest: boolean; demo: boolean; onClose: () => void }) {
  return <Dialog title="So funktioniert’s" onClose={onClose}>
    <p className="dialog-intro">{guest ? 'Hier hängen die Wünsche einer anderen Person. Vielleicht ist das Geschenk dabei, das den Nagel auf den Kopf trifft.' : demo ? 'Willkommen bei Wunschnagel. Hier bekommen deine Wünsche einen festen Platz. Du kannst die Beispielwünsche ändern oder eigene Listen und Wünsche anlegen.' : 'Für jeden Anlass ein Wunschzettel. Für jeden Wunsch ein fester Platz. So funktioniert Wunschnagel.'}</p>
    <ol className="howto-steps">
      {guest ? <>
        <li><strong>Wünsche ansehen</strong><p>Lies die Hinweise zu Größe, Farbe oder Ausführung. „Offen“ zeigt, was sich die Person noch wünscht.</p></li>
        <li><strong>Im Shop öffnen</strong><p>„Zum Shop“ öffnet die Produktseite in einem neuen Tab. Ein Kauf findet direkt beim jeweiligen Shop statt.</p></li>
        <li><strong>Geschenke absprechen</strong><p>Hier kannst du nichts reservieren. Sprich dich mit anderen Schenkenden ab, damit nichts doppelt gekauft wird.</p></li>
      </> : <>
        <li><strong>Liste auswählen oder anlegen</strong><p>Öffne auf dem Handy oben „Listen“. Dort kannst du eine Liste auswählen oder mit „Neue Wunschliste“ eine anlegen, zum Beispiel für Geburtstag oder Weihnachten. Am Computer findest du deine Listen links.</p></li>
        <li><strong>Wünsche festhalten</strong><p>Öffne ein Produkt im Shop und kopiere seinen Link. Tippe unten auf „+ Wunsch“ oder am Computer auf „Wunsch hinzufügen“. Füge den Link ein, prüfe den Titel, ergänze bei Bedarf Hinweise und speichere.</p></li>
        <li><strong>Mit Freunden und Familie teilen</strong><p>{demo ? 'In der lokalen Demo ist Teilen noch nicht möglich. Deine Listen bleiben in diesem Browser.' : 'Wähle „Teilen“ oder am Computer „Liste teilen“, erstelle einen Link und schicke ihn weiter. Die Empfänger brauchen kein Konto und können deine Liste ansehen.'}</p></li>
      </>}
    </ol>
    {!guest && <div className="help-note"><strong>Schon bekommen?</strong><p>Öffne bei einem Wunsch „Bearbeiten“ und wähle „Als erfüllt markieren“. „Erfüllt“ bedeutet, dass du den Wunsch bereits bekommen hast. Es ist keine Reservierung für Schenkende.</p></div>}
    <div className="dialog-actions"><button className="button primary" onClick={onClose}><Check size={16} /> Verstanden</button></div>
  </Dialog>
}

function ListDialog({ list, onClose, onSave, onDelete }: { list: Wishlist | null; onClose: () => void; onSave: (input: ListInput) => Promise<void>; onDelete?: () => void }) {
  const [title, setTitle] = useState(list?.title || '')
  const [description, setDescription] = useState(list?.description || '')
  const [emoji, setEmoji] = useState(list?.emoji || '🌿')
  const [visibility, setVisibility] = useState<Visibility>(list?.visibility || 'private')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { await onSave({ title: title.trim(), description: description.trim(), emoji, visibility }) } catch (e) { setError(message(e)); setBusy(false) } }
  return <Dialog formLayout title={list ? 'Wunschliste bearbeiten' : 'Neue Wunschliste'} onClose={() => !busy && onClose()}>
    <p className="dialog-intro">{list ? 'Ändere Name, Beschreibung oder wer die Liste sehen darf.' : 'Ein neuer Anlass? Zeit für einen nagelneuen Wunschzettel. Gib deiner Liste einen Namen.'}</p>
    <form onSubmit={submit}><FormFields><fieldset disabled={busy}>
      <label className="field">Name deiner Liste<input autoFocus required maxLength={100} value={title} onChange={e => setTitle(e.target.value)} placeholder="Zum Beispiel: Zum Geburtstag" pattern=".*\S.*" /></label>
      <label className="field">Beschreibung <span>optional</span><textarea aria-describedby="list-description-help" maxLength={1000} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Zum Beispiel: Ideen für meinen Geburtstag" /></label>
      <p className="input-help" id="list-description-help">Die Beschreibung sehen auch die Personen, mit denen du die Liste teilst.</p>
      <div className="field">Symbol für die Liste <span>optional</span><div className="emoji-options">{['🌿', '🎂', '🎄', '🏡', '✨', '🎒', '💛', '🎁'].map(value => <button type="button" key={value} aria-label={`Symbol ${value}`} aria-pressed={emoji === value} className={emoji === value ? 'selected' : ''} onClick={() => setEmoji(value)}>{value}</button>)}</div></div>
      <label className="field">Wer darf deine Liste sehen?<span className="select-wrapper"><select aria-describedby="list-visibility-help" value={visibility} onChange={e => setVisibility(e.target.value as Visibility)}>{Object.entries(visibilityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><ChevronDown size={16} /></span></label>
      <p key={visibility} className="field-help" id="list-visibility-help"><PrivacyIcon value={visibility} />{visibilityDescriptions[visibility]}</p>
      {list && list.visibility !== 'private' && visibility === 'private' && <p className="hint">Bestehende Freigabelinks funktionieren dann nicht mehr. Beim späteren Freigeben wird ein neuer Link erstellt.</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </fieldset></FormFields><div className="dialog-actions">
      {onDelete && <button type="button" disabled={busy} className="text-button danger-text delete-list-action" onClick={onDelete}><Trash2 size={16} /> Liste löschen</button>}
      <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Abbrechen</button>
      <button className="button primary" disabled={busy || !title.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} {list ? 'Speichern' : 'Liste erstellen'}</button>
    </div></form>
  </Dialog>
}

function ItemDialog({ item, listTitle, repo, onClose, onSave }: { item: Wish | null; listTitle: string; repo: Repository; onClose: () => void; onSave: (input: WishInput) => Promise<void> }) {
  const [url, setUrl] = useState(item?.url || '')
  const [title, setTitle] = useState(item?.title || '')
  const [notes, setNotes] = useState(item?.notes || '')
  const [image, setImage] = useState(item?.image_url.startsWith('./') ? '' : item?.image_url || '')
  const [price, setPrice] = useState(item?.price?.toString().replace('.', ',') || '')
  const [offerSource, setOfferSource] = useState<OfferSource>(item?.offer_source || 'idealo')
  const [searchTerm, setSearchTerm] = useState(item?.search_term || '')
  const [searchUrl, setSearchUrl] = useState(item?.search_url || '')
  const offers = offerSearch({ title, offer_source: offerSource, search_term: searchTerm, search_url: searchUrl })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const customTitle = useRef(Boolean(item?.title))
  const customImage = useRef(Boolean(item?.image_url))
  const sharedTitle = useRef('')
  const preview = useLinkPreview(url, repo, !item || url !== item.url || !item.image_url)
  const previewBusy = preview.status === 'loading'
  const previewImage = image || (preview.url === item?.url ? item.image_url : '')
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => setImageFailed(false), [previewImage])

  useEffect(() => {
    if (!customTitle.current) setTitle(sharedTitle.current)
    if (!customImage.current) setImage('')
  }, [preview.url])

  useEffect(() => {
    if (!preview.data) return
    if (!customTitle.current && preview.data.title) setTitle(preview.data.title.slice(0, 200))
    if (!customImage.current && preview.data.image_url) setImage(preview.data.image_url)
  }, [preview.data])

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await onSave({
        title: title.trim(), url: webUrl(url), notes: notes.trim(),
        image_url: image ? webUrl(image, false) : item?.image_url.startsWith('./') ? item.image_url : '',
        price: parsePrice(price),
        offer_source: offerSource,
        search_term: searchTerm.trim(),
        search_url: offerSource === 'custom' ? webUrl(searchUrl) : '',
      })
    } catch (e) { setError(message(e)); setBusy(false) }
  }

  return <Dialog formLayout title={item ? 'Wunsch bearbeiten' : 'Wunsch hinzufügen'} onClose={() => !busy && onClose()}>
    <p className="dialog-intro">Füge den Link zur Produktseite ein. Titel und Bild laden automatisch, soweit der Shop es erlaubt. Du kannst die Angaben ändern.</p>
    <form onSubmit={submit}>
      <FormFields><fieldset disabled={busy}>
        <p className="form-destination">Speichern in <strong>{listTitle}</strong></p>
        <label className="field">Link zum Wunsch
          <input autoFocus required type="text" inputMode="url" aria-describedby="wish-link-help" autoCapitalize="none" autoCorrect="off" maxLength={2000} value={url} onChange={e => { sharedTitle.current = ''; setUrl(e.target.value) }} onPaste={event => {
            const product = sharedProduct(event.clipboardData.getData('text'))
            if (!product || product.url === preview.url && !product.title) return
            event.preventDefault()
            sharedTitle.current = product.title
            setUrl(product.url)
            if (!customTitle.current) setTitle(product.title)
          }} placeholder="https://shop.de/dein-wunsch" />
        </label>
        <p className="input-help" id="wish-link-help">Kopiere den Link aus dem Shop oder füge den Text aus „Teilen“ ein. Ein mitgeteilter Produktname wird übernommen.</p>
        <div className={`wish-title-preview ${previewImage ? 'with-image' : ''}`}>
        <label className="field">Dein Wunsch
          <input required maxLength={200} value={title} className={preview.data && !customTitle.current ? 'auto-filled' : undefined} aria-busy={previewBusy} onChange={e => { customTitle.current = true; setTitle(e.target.value) }} placeholder={previewBusy ? 'Titel wird geladen …' : 'Zum Beispiel: Espressokanne für zwei'} pattern=".*\S.*" />
        </label>
        {previewImage && <div className="product-preview">{imageFailed ? <Gift size={24} aria-label="Bild nicht erreichbar" /> : <img src={previewImage} alt="Bildvorschau zum Wunsch" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />}<span>Bildvorschau</span></div>}
        </div>
        {preview.hint && <p key={preview.status} className="preview-hint" role="status">{preview.hint}</p>}
        {preview.data?.title && customTitle.current && title !== preview.data.title && <button type="button" className="text-button preview-retry" onClick={() => { setTitle(preview.data!.title.slice(0, 200)); customTitle.current = true }}>Shop-Titel übernehmen <ArrowDownToLine size={14} /></button>}
        {preview.data?.image_url && customImage.current && image !== preview.data.image_url && <button type="button" className="text-button preview-retry" onClick={() => { setImage(preview.data!.image_url); customImage.current = true }}>Shop-Bild übernehmen <ArrowDownToLine size={14} /></button>}
        {preview.status === 'error' && <button type="button" className="text-button preview-retry" onClick={preview.reload}><RotateCcw size={15} /> Erneut versuchen</button>}
        {imageFailed && <p className="input-help">Das Bild ist nicht erreichbar. Du kannst den Wunsch trotzdem speichern.</p>}
        <label className="field">Notizen &amp; Hinweise <span>optional</span>
          <textarea rows={3} aria-describedby="wish-notes-help" maxLength={3000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Zum Beispiel Größe, Farbe oder was dir daran gefällt …" />
        </label>
        <p className="input-help" id="wish-notes-help">Diese Hinweise helfen beim Schenken und werden mit der Liste geteilt. Damit das Geschenk den Nagel auf den Kopf trifft.</p>

        <section className="offer-search-settings" aria-label="Angebote finden">
          <label className="field">Angebote finden<span className="select-wrapper"><select aria-label="Angebote suchen bei" aria-describedby="offer-source-help" value={offerSource} onChange={event => setOfferSource(event.target.value as OfferSource)}>{Object.entries(offerSources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={16} /></span></label>
          <p className="input-help" id="offer-source-help">Der zusätzliche Button auf deinem Wunsch öffnet direkt eine Angebotsliste oder einen Preisvergleich. Das funktioniert auch für Gäste deiner geteilten Liste.</p>
          {offerSource === 'custom' ? <label className="field">Such- oder Preisvergleichslink<input required type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" value={searchUrl} maxLength={2000} onChange={event => setSearchUrl(event.target.value)} placeholder="https://…" /></label> : <>
            <label className="field">Suchbegriff <span>optional</span><input value={searchTerm} maxLength={200} onChange={event => setSearchTerm(event.target.value)} placeholder={title.trim() || 'Marke und genaue Modellnummer'} aria-describedby="offer-term-help" /></label>
            <p className="input-help" id="offer-term-help">Ohne eigenen Suchbegriff verwenden wir den Titel. Mit Modellnummer, Ausgabe oder Setnummer finden andere leichter das Richtige.</p>
          </>}
          {offers.url && <a className="text-button offer-test-link" href={offers.url} target="_blank" rel="noopener noreferrer">Suchergebnisse testen <ArrowUpRight size={14} /></a>}
        </section>

        <details className="optional-fields" open={item !== null}>
          <summary>Preis &amp; Bild-Link ergänzen <span>optional</span><ChevronDown size={16} /></summary>
          <div className="extra-wish-fields"><p className="input-help">Du kannst einen ungefähren Preis angeben oder das Bild durch eine andere Bildadresse ersetzen. Beide Felder dürfen leer bleiben.</p><div className="form-row">
            <label className="field price-field">Preis in € <span>optional</span><input inputMode="decimal" maxLength={12} value={price} onChange={e => setPrice(e.target.value)} placeholder="29,90" /></label>
            <label className="field">Bild-Link <span>optional</span><input type="url" autoCapitalize="none" autoCorrect="off" maxLength={2000} value={image} onChange={e => { customImage.current = true; setImage(e.target.value) }} placeholder="https://shop.de/bild.jpg" /></label>
          </div><button type="button" className="text-button preview-retry" onClick={preview.reload} disabled={!preview.url || previewBusy}>{previewBusy ? <LoaderCircle className="spin" size={15} /> : <RotateCcw size={15} />} Shop-Vorschau neu laden</button></div>
        </details>
        {error && <p className="form-error" role="alert">{error}</p>}
      </fieldset></FormFields>
      <div className="dialog-actions">
        <p className="save-guidance" id="wish-save-help">{!preview.url ? 'Füge zuerst einen gültigen Shop-Link ein.' : !title.trim() ? previewBusy ? 'Titel wird geladen. Du kannst ihn auch selbst eintragen.' : 'Trage einen Titel für deinen Wunsch ein.' : !offers.url ? 'Füge einen gültigen Such- oder Preisvergleichslink ein.' : 'Shop-Link und Titel sind ausgefüllt. Du kannst jetzt speichern.'}</p>
        <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Abbrechen</button>
        <button className="button primary" aria-describedby="wish-save-help" disabled={busy || !title.trim() || !preview.url || !offers.url}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Wunsch speichern</button>
      </div>
    </form>
  </Dialog>
}

function ShareDialog({ list, demo, onClose, onUpdate, onRotate }: { list: Wishlist; demo: boolean; onClose: () => void; onUpdate: (input: ListInput) => Promise<void>; onRotate: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [confirmRotate, setConfirmRotate] = useState(false)
  const link = list.visibility === 'private' || demo ? '' : shareUrl(list, window.location.href)
  async function act(action: () => Promise<void>) { setBusy(true); setStatus(''); try { await action() } catch (e) { setStatus(message(e)) } finally { setBusy(false) } }
  if (demo) return <Dialog title="Liste teilen" onClose={onClose}>
    <p className="dialog-intro">In der lokalen Demo kannst du noch keine Liste mit anderen teilen.</p>
    <div className="help-note"><strong>Deine Listen bleiben in diesem Browser.</strong><p>Deine Wunschzettel hängen hier zum Ausprobieren. Ein kopierter Link würde deine Liste auf einem anderen Gerät noch nicht anzeigen.</p></div>
    <p className="share-explanation">In der gemeinsam nutzbaren Version kannst du einen Link weitergeben. Freunde und Familie können deine Wünsche dann ohne Anmeldung ansehen.</p>
    <div className="dialog-actions"><button className="button primary" onClick={onClose}>Zurück zur Liste</button></div>
  </Dialog>
  return <Dialog title="Liste teilen" onClose={() => !busy && onClose()}>
    <p className="dialog-intro">{visibilityDescriptions[list.visibility]}</p>
    {list.visibility === 'private' ? <>
      <p className="share-explanation">Erstelle einen Link, damit Freunde und Familie deine Wünsche ansehen können. Damit wird die Liste auf „Mit Link“ umgestellt. Bearbeiten kannst weiterhin nur du.</p>
      <button className="button primary" disabled={busy} onClick={() => act(async () => { await onUpdate({ title: list.title, description: list.description, emoji: list.emoji, visibility: 'link' }) })}>{busy ? <LoaderCircle className="spin" size={16} /> : <Link2 size={16} />} {busy ? 'Link wird erstellt …' : 'Link zum Teilen erstellen'}</button>
    </> : <>
      <label className="field">Dein Link zum Weitergeben<input aria-describedby="share-link-help" readOnly value={link} onFocus={e => e.currentTarget.select()} /></label>
      <p className="input-help" id="share-link-help">Kopiere den Link und schicke ihn zum Beispiel per WhatsApp oder E-Mail. Die Empfänger brauchen kein Konto.</p>
      <div className="share-actions"><button className="button primary" onClick={() => act(async () => { await navigator.clipboard.writeText(link); setStatus('Link kopiert. Schicke deinen Wunschzettel jetzt in einer Nachricht weiter.') })} disabled={busy}><Copy size={16} /> Link kopieren</button>{!!navigator.share && <button className="button secondary" disabled={busy} onClick={() => act(async () => { try { await navigator.share({ title: list.title, text: 'Damit dein Geschenk den Nagel auf den Kopf trifft: meine Wunschliste bei Wunschnagel.', url: link }) } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) throw e } })}><Share2 size={16} /> Über andere App teilen</button>}</div>
      <div className="hint"><PrivacyIcon value={list.visibility} size={18} /><span>Andere können deine Wünsche und Hinweise ansehen. Sie können nichts bearbeiten und keine Geschenke reservieren.</span></div>
      {list.visibility === 'link' && <details className="optional-fields share-advanced"><summary>Freigabelink verwalten <ChevronDown size={16} /></summary><div className="rotate-link"><p>Wenn ein alter Link nicht mehr funktionieren soll, kannst du ihn hier ersetzen. Nur der neue Link öffnet dann deine Liste.</p><button className="text-button" disabled={busy} onClick={() => setConfirmRotate(!confirmRotate)}><RotateCcw size={14} /> Link ersetzen</button>{confirmRotate && <div><p>Alle bisherigen Empfänger brauchen danach den neuen Link.</p><button className="button secondary" disabled={busy} onClick={() => act(async () => { await onRotate(); setConfirmRotate(false); setStatus('Nagelneuer Link erstellt. Kopiere ihn und schicke ihn an die gewünschten Personen.') })}>Alten Link deaktivieren und neuen erstellen</button></div>}</div></details>}
    </>}
    {status && <p className="preview-hint" role="status">{status}</p>}
  </Dialog>
}
