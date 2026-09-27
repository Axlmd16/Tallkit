import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProductLabelPrintModal } from './ProductLabelPrintModal'
import type { ProductLabelData } from './label-layout'

const brandState = vi.hoisted(() => ({
  current: {
    displayName: 'Repuestos La Esquina',
    isError: false,
    isPending: false,
    legalName: 'Repuestos Andinos',
    logoUrl: null as string | null | undefined,
    retry: vi.fn(),
  },
}))

vi.mock('@/shared/api/entity-logos', () => ({
  useIssuerBrandStatus: () => brandState.current,
}))

const products: ProductLabelData[] = [
  {
    id: 1,
    code: 'FIL-00125',
    name: 'Filtro de aceite',
    manufacturerCode: 'PH-2870A',
    productBrand: { id: 1, name: 'Fleetguard' },
  },
  {
    id: 2,
    code: 'PAST-002',
    name: 'Pastillas de freno',
    manufacturerCode: null,
    productBrand: null,
  },
]

const baseProps = {
  onClose: vi.fn(),
  open: true,
  products,
}

beforeEach(() => {
  brandState.current = {
    displayName: 'Repuestos La Esquina',
    isError: false,
    isPending: false,
    legalName: 'Repuestos Andinos',
    logoUrl: null,
    retry: vi.fn(),
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('ProductLabelPrintModal', () => {
  it('prepara una copia por producto y permite aplicar una cantidad a todos', async () => {
    const user = userEvent.setup()
    render(<ProductLabelPrintModal {...baseProps} />)

    expect(screen.getByText('2 etiquetas')).toBeInTheDocument()
    const quantities = screen.getAllByRole('spinbutton', { name: /copias de/i })
    expect(quantities).toHaveLength(2)
    expect(quantities[0]).toHaveValue(1)

    await user.clear(
      screen.getByRole('spinbutton', { name: 'Copias para todos' }),
    )
    await user.type(
      screen.getByRole('spinbutton', { name: 'Copias para todos' }),
      '3',
    )
    await user.click(screen.getByRole('button', { name: 'Aplicar a todos' }))

    expect(quantities[0]).toHaveValue(3)
    expect(quantities[1]).toHaveValue(3)
    expect(screen.getByText('6 etiquetas')).toBeInTheDocument()
  })

  it('mantiene las acciones fijas y ofrece zoom progresivo como un visor', async () => {
    const user = userEvent.setup()
    render(<ProductLabelPrintModal {...baseProps} />)

    expect(screen.getByRole('dialog')).toHaveClass('product-label-print-modal')
    expect(
      screen.getByRole('button', { name: 'Ajustar hoja' }),
    ).toHaveAttribute('aria-pressed', 'true')
    const canvas = screen.getByTestId('product-label-preview-canvas')
    expect(canvas.getAttribute('style')).toContain(
      '--product-label-preview-scale: 0.5',
    )

    await user.click(screen.getByRole('button', { name: 'Aumentar zoom' }))
    await user.click(screen.getByRole('button', { name: 'Aumentar zoom' }))
    expect(
      screen.getByRole('status', { name: 'Nivel de zoom' }),
    ).toHaveTextContent('70 %')
    expect(canvas.getAttribute('style')).toContain(
      '--product-label-preview-scale: 0.7',
    )
    expect(
      screen.getByRole('button', { name: 'Ajustar hoja' }),
    ).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Reducir zoom' }))
    expect(
      screen.getByRole('status', { name: 'Nivel de zoom' }),
    ).toHaveTextContent('60 %')
    await user.click(screen.getByRole('button', { name: 'Ajustar hoja' }))
    expect(canvas.getAttribute('style')).toContain(
      '--product-label-preview-scale: 0.5',
    )
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeVisible()
  })

  it('aísla el desplazamiento de una selección numerosa sin mover la configuración', () => {
    const manyProducts = Array.from({ length: 50 }, (_, index) => ({
      ...products[0]!,
      id: index + 1,
      code: `REP-${String(index + 1).padStart(3, '0')}`,
      name: `Repuesto ${index + 1}`,
    }))

    render(<ProductLabelPrintModal {...baseProps} products={manyProducts} />)

    expect(screen.getByText('50 productos seleccionados')).toBeInTheDocument()
    expect(screen.getByTestId('product-label-quantity-list')).toHaveClass(
      'overflow-y-auto',
    )
    expect(screen.getByRole('heading', { name: 'Tamaño y posición' })).not.toBe(
      screen.getByTestId('product-label-quantity-list'),
    )
  })

  it('muestra errores de cantidades y composición junto a los controles', async () => {
    const user = userEvent.setup()
    render(<ProductLabelPrintModal {...baseProps} />)

    const firstQuantity = screen.getByRole('spinbutton', {
      name: 'Copias de Filtro de aceite',
    })
    await user.clear(firstQuantity)
    await user.type(firstQuantity, '0')
    expect(
      screen.getByText('Ingresa un entero mayor que cero.'),
    ).toBeInTheDocument()

    const width = screen.getByRole('spinbutton', { name: 'Ancho (mm)' })
    await user.clear(width)
    await user.type(width, '30')
    expect(screen.getByText(/Aumenta el tamaño/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeDisabled()
  })

  it('selecciona una posición visual, pagina la vista y anuncia un reinicio', async () => {
    const user = userEvent.setup()
    render(<ProductLabelPrintModal {...baseProps} />)

    await user.click(
      screen.getByRole('button', { name: 'Empezar en posición 8' }),
    )
    expect(
      screen.getByRole('button', { name: 'Empezar en posición 8' }),
    ).toHaveAttribute('aria-pressed', 'true')

    const apply = screen.getByRole('spinbutton', { name: 'Copias para todos' })
    await user.clear(apply)
    await user.type(apply, '20')
    await user.click(screen.getByRole('button', { name: 'Aplicar a todos' }))
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument()

    const width = screen.getByRole('spinbutton', { name: 'Ancho (mm)' })
    const height = screen.getByRole('spinbutton', { name: 'Alto (mm)' })
    await user.clear(width)
    await user.type(width, '105')
    await user.clear(height)
    await user.type(height, '99')
    expect(
      screen.getByText('La posición inicial volvió a 1 porque ya no existe.'),
    ).toBeInTheDocument()
  })

  it('presenta la carga y un error reintentable del lote', async () => {
    const { rerender } = render(
      <ProductLabelPrintModal {...baseProps} loading products={[]} />,
    )
    expect(screen.getByText('Cargando productos…')).toBeInTheDocument()

    const retry = vi.fn()
    rerender(
      <ProductLabelPrintModal
        {...baseProps}
        loadError="No se pudo cargar el lote."
        onRetry={retry}
        products={[]}
      />,
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Reintentar lote' }),
    )
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeDisabled()
  })

  it('bloquea por marca pendiente o fallida y permite reintentarla', async () => {
    brandState.current = { ...brandState.current, isPending: true }
    const { rerender } = render(<ProductLabelPrintModal {...baseProps} />)
    expect(
      screen.getByText('Preparando identidad comercial…'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeDisabled()

    const retry = vi.fn()
    brandState.current = {
      ...brandState.current,
      displayName: undefined as never,
      isError: true,
      isPending: false,
      retry,
    }
    rerender(<ProductLabelPrintModal {...baseProps} />)
    await userEvent.click(
      screen.getByRole('button', { name: 'Reintentar identidad' }),
    )
    expect(retry).toHaveBeenCalledOnce()
  })

  it('resume todos los códigos incompatibles sin transliterarlos', () => {
    render(
      <ProductLabelPrintModal
        {...baseProps}
        products={[
          { ...products[0]!, code: 'FILTRO-Ñ' },
          { ...products[1]!, code: 'BUJÍA-2' },
        ]}
      />,
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('FILTRO-Ñ')
    expect(alert).toHaveTextContent('BUJÍA-2')
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeDisabled()
  })

  it('imprime tras preparar fuentes y conserva todo el estado', async () => {
    const user = userEvent.setup()
    const print = vi.fn()
    vi.stubGlobal('print', print)
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: Promise.resolve() },
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    render(<ProductLabelPrintModal {...baseProps} />)

    const quantity = screen.getByRole('spinbutton', {
      name: 'Copias de Filtro de aceite',
    })
    await user.clear(quantity)
    await user.type(quantity, '4')
    await user.click(screen.getByRole('button', { name: 'Imprimir' }))

    await waitFor(() => expect(print).toHaveBeenCalledOnce())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(quantity).toHaveValue(4)
    expect(screen.getByText('Escala 100 %')).toBeInTheDocument()
    expect(screen.getByText('Sin encabezados ni pies')).toBeInTheDocument()
  })

  it('degrada a solo nombre si el logotipo no responde en cinco segundos', () => {
    vi.useFakeTimers()
    brandState.current = { ...brandState.current, logoUrl: '/slow-logo.png' }
    render(<ProductLabelPrintModal {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeDisabled()

    act(() => vi.advanceTimersByTime(5000))

    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeEnabled()
    expect(screen.getAllByText('Repuestos La Esquina')).not.toHaveLength(0)
  })
})
