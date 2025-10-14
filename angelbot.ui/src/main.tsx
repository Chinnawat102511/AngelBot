import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'                     // ← ต้องมีบรรทัดนี้

import { ToastProvider } from './providers/ToastProvider'
import { LiveProvider } from './providers/LiveProvider'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

createRoot(rootEl).render(
  <React.StrictMode>
    <ToastProvider>
      <LiveProvider>
        <App />
      </LiveProvider>
    </ToastProvider>
  </React.StrictMode>
)
