import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { listSymbols, searchListSymbols, symbolGroups } from './listSymbols'

export function EmojiPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const selected = listSymbols.find(symbol => symbol.emoji === value)
  const matches = searchListSymbols(query, category)

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  function choose(emoji: string) {
    onChange(emoji); setOpen(false); trigger.current?.focus({ preventScroll: true })
  }
  function move(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
    const index = buttons.indexOf(event.target as HTMLButtonElement)
    if (index < 0) return
    const columns = buttons.filter(button => button.offsetTop === buttons[0].offsetTop).length
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, ArrowDown: index + columns, ArrowUp: index - columns, Home: 0, End: buttons.length - 1 }[event.key]
    if (next === undefined) return
    event.preventDefault(); event.stopPropagation()
    buttons[Math.max(0, Math.min(next, buttons.length - 1))]?.focus()
  }

  return <div className="field list-symbol-field" ref={root} onKeyDown={event => {
    if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus({ preventScroll: true }) }
  }}>
    <div className="symbol-field-label">Symbol für die Liste <span>optional</span></div>
    <button ref={trigger} type="button" className="symbol-picker-trigger" aria-label={`Symbol auswählen, aktuell: ${selected?.name || 'Eigenes Symbol'} ${value}`} aria-expanded={open} aria-controls={open ? panelId : undefined}
      onClick={() => { if (!open) { setQuery(''); setCategory('all') } setOpen(!open) }}>
      <span className="symbol-picker-preview" aria-hidden="true">{value}</span><span><strong>{selected?.name || 'Eigenes Symbol'}</strong><small>Symbol ändern</small></span><ChevronDown size={18} aria-hidden="true" />
    </button>
    {open && <section id={panelId} className="symbol-picker-panel" aria-label="Symbolauswahl">
      <label className="symbol-picker-search"><Search size={17} aria-hidden="true" /><span className="screen-reader-only">Symbole suchen</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nach Symbolen suchen …" autoComplete="off" onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); if (matches[0]) choose(matches[0].emoji) }
      }} /></label>
      <label className="symbol-picker-category"><span className="screen-reader-only">Symbolkategorie</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">Alle Symbole</option>{symbolGroups.map(group => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>
      <p className="symbol-picker-count" role="status">{matches.length} {matches.length === 1 ? 'Symbol' : 'Symbole'}</p>
      {matches.length ? <div className="emoji-options symbol-picker-grid" role="group" aria-label="Symbole" onKeyDown={move}>{matches.map(symbol => <button type="button" key={symbol.emoji} aria-label={`${symbol.name} ${symbol.emoji}`} title={symbol.name} aria-pressed={value === symbol.emoji} className={value === symbol.emoji ? 'selected' : ''} onClick={() => choose(symbol.emoji)}><span aria-hidden="true">{symbol.emoji}</span>{value === symbol.emoji && <Check size={12} className="symbol-picker-check" aria-hidden="true" />}</button>)}</div>
        : <div className="symbol-picker-empty"><p>Kein passendes Symbol gefunden.</p><button type="button" className="text-button" onClick={() => { setQuery(''); setCategory('all') }}>Alle Symbole anzeigen</button></div>}
    </section>}
  </div>
}
