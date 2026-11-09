import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export function FormFields({ children, scrollLabel = 'Weitere Felder · nach unten scrollen' }: { children: ReactNode; scrollLabel?: string }) {
  const areaRef = useRef<HTMLDivElement>(null)
  const fieldsRef = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState({ above: false, below: false })

  useLayoutEffect(() => {
    const area = areaRef.current
    const fields = fieldsRef.current
    if (!area || !fields) return
    const update = () => {
      // The cue must not be able to create its own overflow.
      const overflows = fields.scrollHeight > area.clientHeight + 4
      const above = fields.scrollTop > 4
      const below = overflows && fields.scrollHeight - fields.clientHeight - fields.scrollTop > 4
      setScroll(previous => previous.above === above && previous.below === below ? previous : { above, below })
    }
    const observer = new ResizeObserver(update)
    observer.observe(area)
    observer.observe(fields)
    if (fields.firstElementChild) observer.observe(fields.firstElementChild)
    fields.addEventListener('scroll', update, { passive: true })
    const frame = requestAnimationFrame(update)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); fields.removeEventListener('scroll', update) }
  }, [])

  return <div className="form-scroll-area" ref={areaRef}>
    <div className="form-scroll-frame" data-scroll-above={scroll.above} data-scroll-below={scroll.below}>
      <div className="form-fields" ref={fieldsRef}>{children}</div>
    </div>
    <p className="form-scroll-cue" hidden={!scroll.below}><ChevronDown size={16} aria-hidden="true" /><span>{scrollLabel}</span></p>
  </div>
}
