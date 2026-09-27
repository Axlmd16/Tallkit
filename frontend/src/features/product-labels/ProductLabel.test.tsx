import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProductLabel } from './ProductLabel'
import type { ProductLabelData } from './label-layout'

const completeProduct: ProductLabelData = {
  id: 1,
  code: 'FIL-00125',
  name: 'Filtro de aceite reforzado para motor diésel',
  description: 'Protección de alto desempeño para trabajo pesado',
  contentQuantity: '1.000000',
  manufacturerCode: 'PH-2870A',
  productBrand: { id: 4, name: 'Fleetguard' },
  unit: { id: 2, name: 'Galón' },
}

const logoBrand = { displayName: 'Taller Norte', logoUrl: '/logo.png' }

function codeSize(): number {
  return Number(
    screen
      .getByTestId('product-label-code')
      .style.getPropertyValue('--code-size'),
  )
}

describe('ProductLabel', () => {
  it('presenta identidad, código, nombre y descripción sin precio', () => {
    const { container } = render(
      <ProductLabel brand={logoBrand} product={completeProduct} />,
    )

    expect(
      screen
        .getByRole('img', { name: 'Logo de Taller Norte' })
        .querySelector('image'),
    ).toHaveAttribute('href', expect.stringMatching(/^\/logo\.png#.+/))
    expect(screen.queryByText('Taller Norte')).not.toBeInTheDocument()
    expect(screen.getByText('CÓDIGO')).toBeInTheDocument()
    expect(screen.getByTestId('product-label-code')).toHaveTextContent(
      'FIL-00125',
    )
    expect(screen.getByText(completeProduct.name)).toHaveClass(
      'product-label__name',
    )
    expect(screen.getByText(completeProduct.description)).toHaveClass(
      'product-label__description',
    )
    expect(
      screen.queryByTestId('product-image-reserve'),
    ).not.toBeInTheDocument()
    expect(container).not.toHaveTextContent(/precio|\$/i)
  })

  it('ordena número de parte, marca y presentación en la ficha técnica', () => {
    render(<ProductLabel brand={logoBrand} product={completeProduct} />)

    const specs = screen.getByTestId('product-label-specs')
    const rows = within(specs).getAllByRole('group')
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'N.º de parte',
      'Marca',
      'Presentación',
    ])
    expect(within(rows[0]!).getByText('PH-2870A')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('Fleetguard')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('1 Galón')).toBeInTheDocument()
  })

  it('ubica el Code 128 ancho en el pie con el código legible', () => {
    render(<ProductLabel brand={logoBrand} product={completeProduct} />)

    const footer = screen.getByTestId('product-label-footer')
    const barcode = within(footer).getByRole('img', {
      name: 'Código de barras de FIL-00125',
    })
    expect(barcode).toHaveAttribute('shape-rendering', 'crispEdges')
    expect(within(footer).getByText('FIL-00125')).toBeInTheDocument()
    expect(
      Number.parseFloat(
        screen
          .getByTestId('product-label-barcode')
          .style.getPropertyValue('--barcode-width'),
      ),
    ).toBeGreaterThanOrEqual(40)
  })

  it('dibuja el camión fijo con sus bandas diagonales', () => {
    render(<ProductLabel brand={logoBrand} product={completeProduct} />)

    const truck = screen.getByTestId('product-label-truck-art')
    expect(truck).toHaveAttribute('aria-hidden', 'true')
    expect(truck.querySelector('image')).toHaveAttribute(
      'href',
      expect.stringContaining('product-label-truck-background'),
    )
    expect(truck.querySelectorAll('polygon[fill="#f4a51c"]')).toHaveLength(2)
    expect(truck.querySelectorAll('polygon[fill="#13233b"]')).toHaveLength(1)
  })

  it('omite datos opcionales y compacta el encabezado si falla el logotipo', () => {
    render(
      <ProductLabel
        brand={{ displayName: 'Taller Norte', logoUrl: '/broken.png' }}
        product={{
          ...completeProduct,
          description: '',
          manufacturerCode: null,
          productBrand: null,
        }}
      />,
    )

    fireEvent.error(document.querySelector('.product-label__brand-loader')!)

    expect(
      screen.queryByRole('img', { name: 'Logo de Taller Norte' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Taller Norte')).toBeInTheDocument()
    const rows = within(screen.getByTestId('product-label-specs')).getAllByRole(
      'group',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveAttribute('aria-label', 'Presentación')
    expect(screen.queryByText('Fleetguard')).not.toBeInTheDocument()
    expect(
      document.querySelector('.product-label__description'),
    ).not.toBeInTheDocument()
  })

  it('reduce el código largo sin truncarlo ni alterar su valor', () => {
    const longCode = 'REP-2026-CAMION-PESADO-000001'
    const { rerender } = render(
      <ProductLabel brand={logoBrand} product={completeProduct} />,
    )
    const shortSize = codeSize()

    rerender(
      <ProductLabel
        brand={logoBrand}
        product={{ ...completeProduct, code: longCode }}
      />,
    )

    expect(screen.getByTestId('product-label-code')).toHaveTextContent(longCode)
    expect(codeSize()).toBeLessThan(shortSize)
  })

  it('muestra solo el nombre cuando no hay logotipo configurado', () => {
    render(
      <ProductLabel
        brand={{ displayName: 'Comercial Andina', logoUrl: null }}
        product={completeProduct}
      />,
    )

    expect(screen.getByText('Comercial Andina')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /logo/i })).not.toBeInTheDocument()
  })
})
