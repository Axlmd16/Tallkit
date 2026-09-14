import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@/shared/styles/index.css'
import '@/shared/ui/catalog-tokens.css'
import { CatalogApp } from './CatalogApp'

if (!import.meta.env.DEV) {
  throw new Error('El catálogo visual solo está disponible en modo desarrollo.')
}

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <CatalogApp />
    </StrictMode>,
  )
}
