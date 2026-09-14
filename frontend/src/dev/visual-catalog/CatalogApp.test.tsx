import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CatalogApp } from './CatalogApp'

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
    fireEvent.change(searchInput, { target: { value: 'DataTable' } })

    expect(screen.getByText('C34')).toBeInTheDocument()
    expect(screen.queryByText('C01')).not.toBeInTheDocument()
  })

  it('permite seleccionar un componente y ver sus variantes y ficha de procedencia', () => {
    render(<CatalogApp />)
    const item = screen.getByText('C02')
    fireEvent.click(item)

    expect(
      screen.getByRole('heading', { name: 'C02 — Button' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/primario/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/secundario/i).length).toBeGreaterThanOrEqual(1)
  })

  it('permite captura aislada cuando se define el hash con isolate=true e id', () => {
    window.location.hash = '#isolate=true&id=C02'
    render(<CatalogApp />)

    expect(
      screen.queryByRole('heading', { name: /catálogo visual/i }),
    ).not.toBeInTheDocument()
    const isolatedContainer = screen.getByTestId('isolated-view')
    expect(isolatedContainer).toBeInTheDocument()
    expect(screen.getByText(/vista aislada/i)).toBeInTheDocument()
    expect(screen.getByText(/C02/i)).toBeInTheDocument()
  })

  it('permite reset determinista del catálogo', () => {
    render(<CatalogApp />)
    const searchInput = screen.getByPlaceholderText(/buscar componentes/i)
    fireEvent.change(searchInput, { target: { value: 'DataTable' } })
    expect(screen.queryByText('C01')).not.toBeInTheDocument()

    const resetButton = screen.getByRole('button', { name: /limpiar/i })
    fireEvent.click(resetButton)
    expect(screen.getByText('C01')).toBeInTheDocument()
  })
})
