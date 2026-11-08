import { useEffect, useState } from 'react'

const dismissalKey = 'wunschnagel-install-hint-dismissed'
const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true)

export function useInstallPrompt() {
  const [installed, setInstalled] = useState(isInstalled)
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(dismissalKey) === 'true' } catch { return false }
  })
  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)')
    const update = () => setInstalled(isInstalled())
    const onInstalled = () => {
      setInstalled(true)
      setDismissed(true)
      try { sessionStorage.setItem(dismissalKey, 'true') } catch { /* The event still hides the hint. */ }
    }
    display.addEventListener('change', update)
    window.addEventListener('appinstalled', onInstalled)
    return () => { display.removeEventListener('change', update); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  return {
    installed,
    visible: !installed && !dismissed,
    dismiss: () => {
      setDismissed(true)
      try { sessionStorage.setItem(dismissalKey, 'true') } catch { /* Closing still works without storage. */ }
    },
  }
}
