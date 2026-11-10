import { useEffect, useState } from 'react'
import { ArrowRight, Copy, Link2, LoaderCircle, LogIn, Share2, Users } from 'lucide-react'
import { inviteUrl } from '../domain'
import type { Collaboration, ListInvitation, Wishlist } from '../domain'
import type { Repository } from './repository'

const message = (error: unknown) => typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Das hat nicht geklappt. Bitte versuche es erneut.'

export function Invitation({ token, repo, signedIn, onLogin, onAccept }: { token: string; repo: Repository; signedIn: boolean; onLogin: () => Promise<void>; onAccept: (id: string) => Promise<void> }) {
  const [invitation, setInvitation] = useState<ListInvitation | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setInvitation(null); setError('')
    repo.invitation(token).then(data => { if (active) setInvitation(data) }).catch(e => { if (active) setError(message(e)) })
    return () => { active = false }
  }, [repo, token, retry, signedIn])
  async function accept() {
    setBusy(true); setError('')
    try { if (!signedIn) await onLogin(); else await onAccept(await repo.acceptInvite(token)) }
    catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  return <section className="invitation-screen">
    <span className="invitation-mark" aria-hidden="true"><Users size={27} /></span>
    <p className="eyebrow">Gemeinsam Wünsche festhalten</p>
    <h1>{invitation ? <>{invitation.emoji} {invitation.title}</> : 'Einladung zur Wunschliste'}</h1>
    {invitation ? <>
      <p>{invitation.already_joined ? 'Diese Liste gehört bereits zu deinen Listen.' : 'Du bist zum Mitbearbeiten eingeladen. Zusammen könnt ihr Wünsche hinzufügen, ändern, abhaken und löschen.'}</p>
      {!invitation.already_joined && <p className="input-help">Mitbearbeiter haben die gleichen Rechte wie der Besitzer: Sie können die Liste teilen, Einstellungen ändern, Personen entfernen und die Liste löschen. Der Besitzer selbst kann nicht entfernt werden. Nimm die Einladung nur an, wenn du die Person kennst. Die anderen Mitbearbeiter sehen deinen Namen und deine bestätigte E-Mail-Adresse, um den Zugriff zuzuordnen.</p>}
      <button className="button primary" disabled={busy} onClick={() => void accept()}>{busy ? <LoaderCircle size={17} className="spin" /> : signedIn ? <ArrowRight size={17} /> : <LogIn size={17} />}{signedIn ? invitation.already_joined ? 'Liste öffnen' : 'Einladung annehmen' : 'Mit Google anmelden'}</button>
      {!signedIn && <p className="input-help">Melde dich zuerst an. Danach kannst du die Einladung annehmen.</p>}
    </> : !error && <p role="status"><LoaderCircle className="spin" size={18} /> Einladung wird geprüft …</p>}
    {error && <div role="alert" className="form-error"><p>{error}</p><button className="text-button" onClick={() => setRetry(value => value + 1)}>Erneut prüfen</button></div>}
    <a className="text-button" href={import.meta.env.BASE_URL} onClick={() => { try { sessionStorage.removeItem('wunschnagel-pending-invite') } catch { /* Storage may be disabled. */ } }}>Zu meinen Listen</a>
  </section>
}

export function CollaborationPanel({ list, repo, owner, userId, onLeave }: { list: Wishlist; repo: Repository; owner: boolean; userId: string; onLeave: () => Promise<void> }) {
  const [data, setData] = useState<Collaboration | null>(null)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  useEffect(() => {
    if (busy) return
    let active = true
    let pending = false
    async function refresh() {
      if (pending || document.visibilityState === 'hidden') return
      pending = true
      try { const next = await repo.collaboration(list.id); if (active) { setData(next); setLoadError('') } }
      catch (e) { if (active) setLoadError(message(e)) } finally { pending = false }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 10000)
    return () => { active = false; window.clearInterval(timer) }
  }, [repo, list.id, owner, busy])
  async function act(action: () => Promise<void>, success = '', refresh = true) {
    setBusy(true); setError(''); setStatus('')
    try { await action(); if (refresh) { setData(await repo.collaboration(list.id)); setLoadError('') } setConfirm(null); setStatus(success) }
    catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  const link = data?.invite ? inviteUrl(data.invite.token, window.location.href) : ''
  return <section className="collaboration-panel" aria-label="Gemeinsam bearbeiten">
    <p className="dialog-intro">Alle Mitbearbeiter können Wünsche und Listeneinstellungen ändern, beide Links teilen, Personen einladen oder entfernen und die ganze Liste löschen.</p>
    <div className="help-note"><strong>{owner ? 'Du bleibst Besitzer dieser Liste.' : 'Du hast die gleichen Rechte wie der Besitzer.'}</strong><p>Der Besitzer kann nicht aus der Liste entfernt werden.</p></div>
      {!data && !error && !loadError && <p className="input-help" role="status">Einladungen werden geladen …</p>}
      {data && (data.invite ? <>
        <label className="field">Einladungslink zum Mitbearbeiten<input readOnly value={link} onFocus={e => e.currentTarget.select()} /></label>
        <p className="input-help">Gültig bis {new Date(data.invite.expires_at).toLocaleDateString('de-DE')}. Alle mit diesem Link können nach der Anmeldung beitreten. Schicke ihn nur an die gewünschten Personen.</p>
        <div className="share-actions"><button className="button primary" disabled={busy} onClick={() => void act(() => navigator.clipboard.writeText(link), 'Einladungslink kopiert. Schicke ihn an die Personen, die mitbearbeiten sollen.')}><Copy size={16} /> Einladung kopieren</button>{!!navigator.share && <button className="button secondary" disabled={busy} onClick={() => void act(async () => { try { await navigator.share({ title: list.title, text: 'Lass uns diese Wunschliste bei Wunschnagel gemeinsam bearbeiten.', url: link }) } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) throw e } })}><Share2 size={16} /> Einladung teilen</button>}</div>
        <button className="text-button" disabled={busy} onClick={() => setConfirm('invite')}>Einladungslink deaktivieren</button>
        {confirm === 'invite' && <div className="collaboration-confirm"><p>Mit diesem Link kann danach niemand mehr beitreten. Bestehende Mitglieder behalten ihren Zugriff. Mitbearbeiter können einen neuen Einladungslink erstellen.</p><button className="button secondary" disabled={busy} onClick={() => void act(() => repo.revokeInvite(list.id), 'Einladungslink deaktiviert.')}>Jetzt deaktivieren</button><button className="text-button" onClick={() => setConfirm(null)}>Abbrechen</button></div>}
      </> : <button className="button primary" disabled={busy} onClick={() => void act(() => repo.createInvite(list.id))}>{busy ? <LoaderCircle size={16} className="spin" /> : <Link2 size={16} />} Einladungslink erstellen</button>)}
      {data && <div className="collaboration-members">
        <h3>Mitbearbeiter <span>({data.members.filter(member => member.user_id !== list.owner_id).length + 1})</span></h3>
        <ul>
          <li><span>{data.owner?.display_name || 'Besitzer'}<small>Besitzer · kann nicht entfernt werden</small>{data.owner?.email && <small className="owner-email">{data.owner.email}</small>}</span></li>
          {data.members.filter(member => member.user_id !== list.owner_id).map(member => <li key={member.user_id}>
            <span>{member.display_name}{member.user_id === userId && <small>Du</small>}{member.email && <small className="member-email">{member.email}</small>}</span>
            {member.user_id !== userId && <button className="text-button" disabled={busy} aria-label={`${member.display_name} entfernen`} onClick={() => setConfirm(member.user_id)}>Entfernen</button>}
            {confirm === member.user_id && <div className="collaboration-confirm"><p>{member.display_name} verliert die Bearbeitungsrechte. Ein bestehender Einladungslink wird ebenfalls deaktiviert, damit die Person nicht erneut beitreten kann. Öffentlich oder per Ansichtslink bleibt die Liste weiterhin lesbar.</p><button className="button danger" disabled={busy} onClick={() => void act(() => repo.removeMember(list.id, member.user_id), 'Person entfernt. Andere bestehende Mitglieder behalten ihren Zugriff.')}>Person entfernen</button><button className="text-button" onClick={() => setConfirm(null)}>Abbrechen</button></div>}
          </li>)}
        </ul>
      </div>}
    {!owner && <>
      <button className="text-button" disabled={busy} onClick={() => setConfirm('leave')}>Gemeinsame Liste verlassen</button>
      {confirm === 'leave' && <div className="collaboration-confirm"><p>Die Liste verschwindet aus deinen Listen. Die Wünsche bleiben für die anderen erhalten. Zum erneuten Beitreten brauchst du eine gültige Einladung.</p><button className="button danger" disabled={busy} onClick={() => void act(async () => { await repo.leaveList(list.id); await onLeave() }, '', false)}>Liste verlassen</button><button className="text-button" onClick={() => setConfirm(null)}>Abbrechen</button></div>}
    </>}
    {(error || loadError) && <div role="alert" className="form-error"><p>{error || loadError}</p>{!data && <button className="text-button" disabled={busy} onClick={() => void act(async () => {})}>Erneut laden</button>}</div>}
    {status && <p className="preview-hint" role="status">{status}</p>}
  </section>
}
