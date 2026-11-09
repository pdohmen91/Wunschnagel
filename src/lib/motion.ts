import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'

// One rhythm for the whole wish catalogue. Motion never delays a data operation.
export const motion = { quick: 160, normal: 280, layout: 360, ease: 'cubic-bezier(.22, 1, .36, 1)' }
const active = new Set<Animation>()
const closing = new WeakMap<HTMLElement, Promise<void>>()
let lastOpener: HTMLElement | null = null
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const dialogOpener = () => lastOpener?.isConnected ? lastOpener : document.activeElement as HTMLElement | null

export function animate(node: Element | null, frames: Keyframe[], duration = motion.normal, delay = 0) {
  if (!node || reducedMotion()) return null
  const animation = node.animate(frames, { duration, delay, easing: motion.ease })
  active.add(animation)
  animation.finished.then(() => active.delete(animation), () => active.delete(animation))
  return animation
}

export function dismissDialog(dialog: HTMLDialogElement | null): Promise<void> {
  if (!dialog || !dialog.open) return Promise.resolve()
  const pending = closing.get(dialog)
  if (pending) return pending
  dialog.dataset.closing = 'true'
  const exit = animate(dialog, [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(12px) scale(.985)' }], motion.quick)
  const done = (exit?.finished ?? Promise.resolve()).catch(() => {}).then(() => { closing.delete(dialog) })
  closing.set(dialog, done)
  return done
}

export function closeDetails(details: HTMLDetailsElement) {
  const pending = closing.get(details)
  if (pending) return pending
  if (!details.open) return Promise.resolve()
  const content = details.querySelector<HTMLElement>(':scope > div')
  const frames = details.classList.contains('optional-fields')
    ? [{ height: `${content?.getBoundingClientRect().height ?? 0}px`, opacity: 1 }, { height: '0px', opacity: 0 }]
    : [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(-5px) scale(.97)' }]
  if (content) content.style.overflow = 'hidden'
  const exit = animate(content, frames, motion.quick)
  const done = (exit?.finished ?? Promise.resolve()).catch(() => {}).then(() => {
    details.open = false
    if (content) content.style.removeProperty('overflow')
    closing.delete(details)
  })
  closing.set(details, done)
  return done
}

export function installInteractionMotion() {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const onPreference = () => { if (preference.matches) active.forEach(animation => animation.cancel()) }
  // Capture before React handles the click. WebKit can clear native focus on
  // mouse-up, so remembering the actual control is more reliable than focus.
  const rememberOpener = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return
    const control = event.target.closest<HTMLElement>('button, summary, .wish-image-link, .shop-link, .offer-search-link')
    if (!control || control.matches(':disabled') || control.closest('dialog, [inert]')) return
    lastOpener = control.closest('.card-menu')?.querySelector('summary') ?? control
  }
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return
    const control = event.target.closest<HTMLElement>('button, summary, .shop-link, .brand')
    if (!control || control.matches(':disabled')) return
    // A short ink press also acknowledges touch and keyboard activation.
    animate(control, [{ filter: 'brightness(1)' }, { filter: 'brightness(.86)', offset: .3 }, { filter: 'brightness(1)' }], 220)
    const summary = event.target.closest('summary')
    const details = summary?.parentElement as HTMLDetailsElement | null
    if (!details?.matches('.card-menu, .optional-fields')) return
    event.preventDefault()
    if (closing.has(details)) return
    if (details.open) { void closeDetails(details); return }
    details.open = true
    const content = details.querySelector<HTMLElement>(':scope > div')
    if (!content) return
    if (details.classList.contains('optional-fields')) {
      const height = content.getBoundingClientRect().height
      content.style.overflow = 'hidden'
      const entry = animate(content, [{ height: '0px', opacity: 0 }, { height: `${height}px`, opacity: 1 }])
      const clear = () => content.style.removeProperty('overflow')
      if (entry) void entry.finished.then(clear, clear)
      else clear()
    } else {
      animate(content, [{ opacity: 0, transform: 'translateY(-7px) scale(.96)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], 220)
    }
  }
  document.addEventListener('click', onClick)
  document.addEventListener('click', rememberOpener, true)
  preference.addEventListener('change', onPreference)
  return () => {
    document.removeEventListener('click', onClick)
    document.removeEventListener('click', rememberOpener, true)
    preference.removeEventListener('change', onPreference)
    active.forEach(animation => animation.cancel())
  }
}

type Position = { x: number; y: number; width: number; height: number; copy: HTMLElement }

// FLIP keeps existing cards attached to their identity while search and sorting rearrange them.
export function useCardMotion(ref: RefObject<HTMLDivElement | null>, revision: string) {
  const previous = useRef(new Map<string, Position>())
  const localAnimations = useRef(new Set<Animation>())
  const ghosts = useRef(new Set<HTMLElement>())
  useLayoutEffect(() => () => {
    localAnimations.current.forEach(animation => animation.cancel())
    ghosts.current.forEach(node => node.remove())
    previous.current.clear()
  }, [])
  useLayoutEffect(() => {
    const grid = ref.current
    if (!grid) return
    const next = new Map<string, Position>()
    const track = (animation: Animation | null) => {
      if (!animation) return
      localAnimations.current.add(animation)
      const clear = () => localAnimations.current.delete(animation)
      void animation.finished.then(clear, clear)
    }
    grid.querySelectorAll<HTMLElement>(':scope > [data-wish-id]').forEach((node, index) => {
      node.getAnimations().forEach(animation => animation.cancel())
      const box = node.getBoundingClientRect()
      const id = node.dataset.wishId!
      const position = { x: box.left + scrollX, y: box.top + scrollY, width: box.width, height: box.height, copy: node.cloneNode(true) as HTMLElement }
      next.set(id, position)
      const old = previous.current.get(id)
      const visible = box.bottom > 0 && box.top < innerHeight
      if (visible && old) {
        const dx = old.x - position.x
        const dy = old.y - position.y
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) track(animate(node, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], motion.layout))
      } else if (visible) {
        track(animate(node, [{ opacity: 0, transform: 'translateY(16px) rotate(.6deg) scale(.985)' }, { opacity: 1, transform: 'translateY(0) rotate(0) scale(1)' }], 420, Math.min(index * 45, 180)))
      }
    })
    if (!reducedMotion()) previous.current.forEach((old, id) => {
      if (next.has(id) || old.y - scrollY > innerHeight || old.y + old.height - scrollY < 0) return
      const ghost = document.createElement('div')
      ghost.className = 'motion-ghost'
      ghost.setAttribute('aria-hidden', 'true')
      ghost.inert = true
      Object.assign(ghost.style, { left: `${old.x - scrollX}px`, top: `${old.y - scrollY}px`, width: `${old.width}px`, height: `${old.height}px` })
      old.copy.removeAttribute('data-wish-id')
      old.copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'))
      old.copy.querySelectorAll('details').forEach(node => node.remove())
      ghost.append(old.copy)
      document.body.append(ghost)
      ghosts.current.add(ghost)
      const exit = animate(ghost, [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(8px) scale(.97)' }], motion.quick)
      const clear = () => { ghost.remove(); ghosts.current.delete(ghost) }
      if (exit) { track(exit); void exit.finished.then(clear, clear) } else clear()
    })
    previous.current = next
  }, [ref, revision])
}

export function useHeightMotion(ref: RefObject<HTMLElement | null>, expanded: boolean) {
  const height = useRef<number | null>(null)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const next = node.getBoundingClientRect().height
    const old = height.current
    height.current = next
    if (old !== null && Math.abs(old - next) > 1) {
      const transition = animate(node, [{ height: `${old}px` }, { height: `${next}px` }])
      return () => transition?.cancel()
    }
  }, [ref, expanded])
}
