export type ViewportBounds = {
  viewportWidth: number
  windowWidth: number
  windowLeft: number
  screenLeft: number
  screenWidth: number
}

/** Account for a host window extending beyond the current display. */
export function visibleContentWidth(bounds: ViewportBounds): number {
  const { viewportWidth, windowWidth, windowLeft, screenLeft, screenWidth } = bounds
  if (![viewportWidth, windowWidth, windowLeft, screenLeft, screenWidth].every(Number.isFinite) || viewportWidth <= 0) return viewportWidth
  if (viewportWidth <= screenWidth || windowWidth <= screenWidth || screenWidth <= 0 || windowLeft < screenLeft || windowLeft >= screenLeft + screenWidth) return viewportWidth
  const clippedRight = Math.max(0, windowLeft + windowWidth - screenLeft - screenWidth)
  return Math.max(1, Math.min(viewportWidth, viewportWidth - clippedRight))
}

/** The keyboard may cover part of a layout viewport without resizing it. */
export function visibleVerticalBounds(layoutHeight: number, visual: { height: number; offsetTop: number; scale: number } | null) {
  if (!visual || ![visual.height, visual.offsetTop, visual.scale].every(Number.isFinite) || visual.height <= 0 || Math.abs(visual.scale - 1) > .01) return { height: layoutHeight, top: 0 }
  const height = Math.min(layoutHeight, visual.height)
  const top = Math.max(0, Math.min(visual.offsetTop, layoutHeight - height))
  return { height, top }
}

export function installViewportFit(): () => void {
  const update = () => {
    document.documentElement.dataset.iosStandalone = String('standalone' in navigator && navigator.standalone === true)
    const display = window.screen as Screen & { availLeft?: number }
    const width = visibleContentWidth({
      viewportWidth: window.innerWidth,
      windowWidth: window.outerWidth,
      windowLeft: window.screenX,
      screenLeft: display.availLeft ?? 0,
      screenWidth: display.availWidth,
    })
    document.documentElement.style.setProperty('--app-visible-width', `${width}px`)
    const bounds = visibleVerticalBounds(window.innerHeight, window.visualViewport)
    document.documentElement.style.setProperty('--app-visible-height', `${bounds.height}px`)
    document.documentElement.style.setProperty('--app-visible-top', `${bounds.top}px`)
    document.documentElement.dataset.keyboardOpen = String(bounds.height < window.innerHeight - 120)
  }
  update()
  window.addEventListener('resize', update)
  window.addEventListener('focus', update)
  window.addEventListener('pageshow', update)
  window.visualViewport?.addEventListener('resize', update)
  window.visualViewport?.addEventListener('scroll', update)
  return () => {
    window.removeEventListener('resize', update)
    window.removeEventListener('focus', update)
    window.removeEventListener('pageshow', update)
    window.visualViewport?.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('scroll', update)
  }
}
