import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CatalogApp } from './CatalogApp'
import { CATALOG } from './registry'

describe('CatalogApp - Aislamiento e independencia', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
    window.location.hash = ''
  })

  it('se monta dentro de un contenedor con data-visual-catalog', () => {
    const { container } = render(<CatalogApp />)
    const root = container.querySelector('[data-visual-catalog]')
    expect(root).not.toBeNull()
  })

  it('no realiza ninguna solicitud a la API al inicializarse', () => {
    render(<CatalogApp />)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('muestra el título del catálogo visual y navegación inicial', () => {
    render(<CatalogApp />)
    expect(
      screen.getByRole('heading', { name: /catálogo visual/i }),
    ).toBeInTheDocument()
  })

  it('permite filtrar componentes mediante la barra de búsqueda', () => {
    render(<CatalogApp />)
    const searchInput = screen.getByPlaceholderText(/buscar componentes/i)
    fireEvent.change(searchInput, { target: { value: 'combobox' } })

    const nav = screen.getByRole('navigation', {
      name: 'Componentes del catálogo',
    })
    expect(within(nav).getByText('TK-06')).toBeInTheDocument()
    expect(within(nav).queryByText('TK-01')).not.toBeInTheDocument()
  })

  it('muestra el ejemplo y la procedencia del componente elegido', () => {
    render(<CatalogApp />)
    fireEvent.click(screen.getByRole('button', { name: /TK-03 Botones/ }))

    expect(screen.getByRole('heading', { name: 'Botones' })).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Ejemplo de Botones' }),
    ).toHaveTextContent('Anular venta')
    expect(screen.getByText(/Tablero «Fundamentos»/)).toBeInTheDocument()
  })

  it('documenta y reproduce una variante en un ancho registrado', () => {
    render(<CatalogApp />)
    fireEvent.click(screen.getByRole('button', { name: /TK-03 Botones/ }))

    expect(
      screen.getByText('La variante procesando impide envíos repetidos.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Sin diferencias conocidas.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Variante o estado'), {
      target: { value: 'Procesando' },
    })
    fireEvent.change(screen.getByLabelText('Ancho de revisión'), {
      target: { value: '360' },
    })

    expect(screen.getByTestId('catalog-preview-frame')).toHaveAttribute(
      'data-catalog-variant',
      'Procesando',
    )
    expect(screen.getByTestId('catalog-preview-frame')).toHaveAttribute(
      'data-catalog-width',
      '360',
    )
    expect(screen.getByRole('link', { name: 'Vista aislada' })).toHaveAttribute(
      'href',
      '#isolate=true&id=TK-03&variant=Procesando&width=360',
    )
  })

  it('permite captura aislada cuando se define el hash con isolate=true e id', () => {
    window.location.hash = '#isolate=true&id=TK-03'
    render(<CatalogApp />)

    expect(
      screen.queryByRole('heading', { name: /catálogo visual/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('isolated-view')).toHaveTextContent(
      'TK-03 — Botones',
    )
  })

  it('restablece el ejemplo de forma determinista', () => {
    render(<CatalogApp />)
    fireEvent.click(screen.getByRole('button', { name: /TK-05/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Crédito' }))
    expect(screen.getByRole('radio', { name: 'Crédito' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer ejemplo' }))
    expect(screen.getByRole('radio', { name: 'Contado' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('cada entrada del registro tiene un ejemplo que se renderiza', () => {
    for (const entry of CATALOG) {
      window.location.hash = `#isolate=true&id=${entry.id}`
      const { unmount } = render(<CatalogApp />)
      expect(screen.getByTestId('isolated-view')).toHaveTextContent(entry.name)
      expect(screen.queryByText('Sin ejemplo.')).toBeNull()
      unmount()
    }
  })
})
