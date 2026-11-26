import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { unlockSpeechOnFirstGesture } from './services/speech/synthesis'

unlockSpeechOnFirstGesture()

// Offline support + "Zum Home-Bildschirm" on iPad. Not in dev (would cache stale modules) and not in the extension.
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
