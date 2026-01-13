import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initAnalytics } from '@/lib/analytics'
import './styles/global.css'

// Initialize analytics before rendering (no-ops if VITE_POSTHOG_KEY is not set)
initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
