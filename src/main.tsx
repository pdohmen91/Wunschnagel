import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './motion.css'
import { installViewportFit } from './viewport'
import { installInteractionMotion } from './lib/motion'

if (window.top !== window.self) {
  // GitHub Pages cannot set frame-ancestors headers. Do not mount any
  // authenticated interface inside an iframe, including sandboxed frames.
  const message = document.createElement('p')
  message.textContent = 'Öffne Wunschnagel direkt, um deine Listen sicher zu verwenden.'
  const link = document.createElement('a')
  link.href = import.meta.env.BASE_URL; link.target = '_top'; link.rel = 'noopener'; link.textContent = 'Wunschnagel öffnen'
  document.getElementById('root')!.append(message, link)
} else {
  const disposeViewportFit = installViewportFit()
  const disposeMotion = installInteractionMotion()
  import.meta.hot?.dispose(() => { disposeViewportFit(); disposeMotion() })

  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(console.error)
    })
  }
}
