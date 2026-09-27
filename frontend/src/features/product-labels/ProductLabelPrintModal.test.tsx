import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
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
    description: 'Para motor diésel',
    contentQuantity: '1.000000',
    manufacturerCode: 'PH-2870A',
    productBrand: { id: 1, name: 'Fleetguard' },
    unit: { id: 1, name: 'Unidad' },
  },
  {
    id: 2,
    code: 'PAST-002',
    name: 'Pastillas de freno',
    description: '',
    contentQuantity: '1.000000',
    manufacturerCode: null,
    productBrand: null,
    unit: { id: 1, name: 'Unidad' },
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

  it('ajusta copias con los botones de cada producto sin bajar de una', async () => {
    const user = userEvent.setup()
    render(<ProductLabelPrintModal {...baseProps} />)

    const quantity = screen.getByRole('spinbutton', {
      name: 'Copias de Filtro de aceite',
    })
    await user.click(
      screen.getByRole('button', {
        name: 'Añadir una copia de Filtro de aceite',
      }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Añadir una copia de Filtro de aceite',
      }),
    )
    expect(quantity).toHaveValue(3)
    expect(screen.getByText('4 etiquetas')).toBeInTheDocument()

    const remove = screen.getByRole('button', {
      name: 'Quitar una copia de Pastillas de freno',
    })
    expect(remove).toBeDisabled()
    await user.click(
      screen.getByRole('button', {
        name: 'Quitar una copia de Filtro de aceite',
      }),
    )
    expect(quantity).toHaveValue(2)
  })

  it('resalta en la vista previa las etiquetas del producto señalado', () => {
    render(<ProductLabelPrintModal {...baseProps} />)

    const row = screen.getByTestId('product-label-quantity-row-2')
    fireEvent.mouseEnter(row)
    const highlighted = screen
      .getAllByTestId('product-label-cell')
      .filter((cell) => cell.dataset.highlighted === 'true')
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0]).toHaveTextContent('PAST-002')

    fireEvent.mouseLeave(row)
    expect(
      screen
        .getAllByTestId('product-label-cell')
        .filter((cell) => cell.dataset.highlighted === 'true'),
    ).toHaveLength(0)
  })

  it('muestra la hoja en miniatura con posiciones usadas y ocupadas', async () => {
    const user = userEvent.setup()
    render(<ProductLabelPrintModal {...baseProps} />)

    await user.click(
      screen.getByRole('button', { name: 'Empezar en posición 4' }),
    )
    const sheet = screen.getByRole('group', { name: 'Posición inicial' })
    const states = within(sheet)
      .getAllByRole('button')
      .map((button) => button.dataset.state)
    expect(states.slice(0, 6)).toEqual([
      'skipped',
      'skipped',
      'skipped',
      'start',
      'filled',
      'empty',
    ])
  })

  it('recorre las páginas desde sus miniaturas y resume el lote', async () => {
    const user = userEvent.setup()
    render(<ProductLabelPrintModal {...baseProps} />)

    const apply = screen.getByRole('spinbutton', { name: 'Copias para todos' })
    await user.clear(apply)
    await user.type(apply, '6')
    await user.click(screen.getByRole('button', { name: 'Aplicar a todos' }))

    expect(screen.getByText('12 etiquetas · 2 hojas')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver página 2' }))
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ver página 2' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('mantiene las acciones fijas y ofrece zoom progresivo como un visor', async () => {
    const user = userEvent.setup()
    render(<ProductLabelPrintModal {...baseProps} />)

    expect(screen.getByRole('dialog')).toHaveClass('product-label-print-modal')
    const fitWidth = screen.getByRole('button', { name: 'Ajustar ancho' })
    const fitPage = screen.getByRole('button', { name: 'Ver hoja completa' })
    expect(fitWidth).toHaveAttribute('aria-pressed', 'true')
    expect(fitPage).toHaveAttribute('aria-pressed', 'false')
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
    expect(fitWidth).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Reducir zoom' }))
    expect(
      screen.getByRole('status', { name: 'Nivel de zoom' }),
    ).toHaveTextContent('60 %')
    await user.click(fitPage)
    expect(fitPage).toHaveAttribute('aria-pressed', 'true')
    expect(canvas.getAttribute('style')).toContain(
      '--product-label-preview-scale: 0.5',
    )
    await user.click(fitWidth)
    expect(fitWidth).toHaveAttribute('aria-pressed', 'true')
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
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeDisabled()
  })

  it('informa el tamaño fijo sin selector ni medidas editables', () => {
    render(<ProductLabelPrintModal {...baseProps} />)

    expect(screen.getByText('100 × 55 mm · 10 por hoja')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('spinbutton', { name: /Ancho|Alto/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /Empezar en posición/ }),
    ).toHaveLength(10)
  })

  it('selecciona una posición visual y pagina la vista', async () => {
    const user = userEvent.setup()
    render(<ProductLabelPrintModal {...baseProps} />)

    await user.click(
      screen.getByRole('button', { name: 'Empezar en posición 4' }),
    )
    expect(
      screen.getByRole('button', { name: 'Empezar en posición 4' }),
    ).toHaveAttribute('aria-pressed', 'true')

    const apply = screen.getByRole('spinbutton', { name: 'Copias para todos' })
    await user.clear(apply)
    await user.type(apply, '5')
    await user.click(screen.getByRole('button', { name: 'Aplicar a todos' }))
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument()
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

  it('espera todos los logotipos de la superficie impresa antes de imprimir', async () => {
    brandState.current = { ...brandState.current, logoUrl: '/logo.png' }
    const complete = vi
      .spyOn(HTMLImageElement.prototype, 'complete', 'get')
      .mockReturnValue(false)
    const print = vi.fn()
    vi.stubGlobal('print', print)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    render(<ProductLabelPrintModal {...baseProps} />)

    fireEvent.load(document.querySelector('.product-label__brand-loader')!)
    const printButton = screen.getByRole('button', { name: 'Imprimir' })
    expect(printButton).toBeEnabled()
    await userEvent.click(printButton)

    const printImages = document.querySelectorAll(
      '.product-label-print-surface img',
    )
    expect(printImages.length).toBeGreaterThan(1)
    expect(print).not.toHaveBeenCalled()
    printImages.forEach((image) => fireEvent.load(image))

    await waitFor(() => expect(print).toHaveBeenCalledOnce())
    complete.mockRestore()
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
