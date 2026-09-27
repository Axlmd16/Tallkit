import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProductLabel } from './ProductLabel'
import type { ProductLabelData } from './label-layout'

const completeProduct: ProductLabelData = {
  id: 1,
  code: 'FIL-00125',
  name: 'Filtro de aceite reforzado para motor diésel',
  manufacturerCode: 'PH-2870A',
  productBrand: { id: 4, name: 'Fleetguard' },
}

describe('ProductLabel', () => {
  it('presenta la identidad, datos del producto y Code 128 sin precio', () => {
    const { container } = render(
      <ProductLabel
        brand={{ displayName: 'Taller Norte', logoUrl: '/logo.png' }}
        product={completeProduct}
      />,
    )

    expect(screen.getByText('Taller Norte')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Logo de Taller Norte' }),
    ).toHaveAttribute('src', '/logo.png')
    expect(screen.getByText('FIL-00125')).toHaveClass('font-mono')
    expect(screen.getByText('CÓDIGO INTERNO')).toBeInTheDocument()
    expect(screen.getByText('REPUESTO')).toBeInTheDocument()
    expect(screen.getByText(completeProduct.name)).toHaveClass('line-clamp-2')
    expect(screen.getByText('N.º DE PARTE')).toBeInTheDocument()
    expect(screen.getByText('PH-2870A')).toBeInTheDocument()
    expect(screen.getByText('MARCA')).toBeInTheDocument()
    expect(screen.getByText('Fleetguard')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Código de barras de FIL-00125' }),
    ).toHaveAttribute('shape-rendering', 'crispEdges')
    expect(container).not.toHaveTextContent(/precio|\$/i)
  })

  it('omite datos opcionales y compacta el encabezado si falla el logotipo', () => {
    render(
      <ProductLabel
        brand={{ displayName: 'Taller Norte', logoUrl: '/broken.png' }}
        product={{
          ...completeProduct,
          manufacturerCode: null,
          productBrand: null,
        }}
      />,
    )

    fireEvent.error(screen.getByRole('img', { name: 'Logo de Taller Norte' }))

    expect(
      screen.queryByRole('img', { name: 'Logo de Taller Norte' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/N.º de parte/)).not.toBeInTheDocument()
    expect(screen.queryByText('Fleetguard')).not.toBeInTheDocument()
  })

  it('muestra solo el nombre cuando no hay logotipo configurado', () => {
    render(
      <ProductLabel
        brand={{ displayName: 'Comercial Andina', logoUrl: null }}
        product={completeProduct}
      />,
    )

    expect(screen.getByText('Comercial Andina')).toBeInTheDocument()
    expect(screen.queryByAltText(/logo/i)).not.toBeInTheDocument()
  })
})
