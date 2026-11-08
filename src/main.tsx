import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './motion.css'
import { installViewportFit } from './viewport'
import { installInteractionMotion } from './lib/motion'

const disposeViewportFit = installViewportFit()
const disposeMotion = installInteractionMotion()
import.meta.hot?.dispose(() => { disposeViewportFit(); disposeMotion() })

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(console.error)
  })
}
