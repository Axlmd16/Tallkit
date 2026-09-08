import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/App'
import '@/shared/styles/index.css'

const root = document.querySelector<HTMLDivElement>('#root')
if (!root) throw new Error('No se encontró el contenedor raíz de la aplicación')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
