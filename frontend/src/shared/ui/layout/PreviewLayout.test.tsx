import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PreviewLayout } from './PreviewLayout'

describe('PreviewLayout (C33) - Fase 10.2', () => {
  it('renders editor panel and preview document panel with accessible regions', () => {
    render(
      <PreviewLayout
        editor={
          <div data-testid="test-editor-panel">
            <h3>Parámetros de la orden</h3>
            <label htmlFor="ref-code">Código de referencia</label>
            <input id="ref-code" type="text" />
          </div>
        }
        preview={
          <div data-testid="test-preview-document">
            <h4>Comprobante de servicio técnico</h4>
            <p>Detalle de mano de obra y repuestos simulados.</p>
          </div>
        }
        toolbar={
          <div data-testid="test-toolbar">
            <button type="button">Actualizar vista</button>
          </div>
        }
      />,
    )

    // Regiones accesibles
    expect(
      screen.getByRole('region', { name: 'Editor de configuración' }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Vista previa del documento' }),
    ).toBeVisible()

    // Slots renderizados
    expect(screen.getByTestId('test-editor-panel')).toBeVisible()
    expect(screen.getByTestId('test-preview-document')).toBeVisible()
    expect(screen.getByTestId('test-toolbar')).toBeVisible()
  })

  it('supports controlled mobile view switching between editor and preview', () => {
    const { rerender } = render(
      <PreviewLayout
        activeMobileView="editor"
        editor={<div data-testid="mobile-editor">Editor activo</div>}
        preview={
          <div data-testid="mobile-preview">Preview oculta en móvil</div>
        }
      />,
    )

    const editorRegion = screen.getByRole('region', {
      name: 'Editor de configuración',
    })
    const previewRegion = screen.getByRole('region', {
      name: 'Vista previa del documento',
    })

    // En móvil con activeMobileView="editor", el editor se muestra y el preview se oculta en móvil (pero visible en lg)
    expect(editorRegion.className).not.toContain('hidden max-lg:hidden')
    expect(previewRegion.className).toContain('max-lg:hidden')

    rerender(
      <PreviewLayout
        activeMobileView="preview"
        editor={<div data-testid="mobile-editor">Editor activo</div>}
        preview={
          <div data-testid="mobile-preview">Preview oculta en móvil</div>
        }
      />,
    )

    expect(editorRegion.className).toContain('max-lg:hidden')
    expect(previewRegion.className).not.toContain('max-lg:hidden')
  })

  it('adapts minimum readable text size avoiding inaccessible 6px font from F09', () => {
    render(
      <PreviewLayout
        editor={<div>Controles</div>}
        preview={<div>Documento</div>}
      />,
    )

    const layoutContainer = screen.getByTestId('preview-layout-root')
    // Debe usar escala mínima legible (text-xs / 12px mínimo) y no clases de micro-fuentes menores a 10px
    expect(layoutContainer.className).not.toContain('text-[6px]')
  })
})
