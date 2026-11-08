import { useLayoutEffect, useState } from 'react'

// Match the layout's container breakpoint, including a clipped desktop window.
export function useCompactLayout() {
  const [compact, setCompact] = useState(() => (document.getElementById('root')?.clientWidth ?? innerWidth) <= 960)
  useLayoutEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    const update = () => setCompact(root.clientWidth <= 960)
    const observer = new ResizeObserver(update)
    observer.observe(root)
    update()
    return () => observer.disconnect()
  }, [])
  return compact
}
