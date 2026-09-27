import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ProductLabelSheet } from './ProductLabelSheet'
import {
  buildLabelPages,
  calculateLabelGrid,
  type ProductLabelData,
} from './label-layout'

vi.mock('./ProductLabel', () => ({
  ProductLabel: ({ product }: { product: ProductLabelData }) => (
    <div data-testid="rendered-label">{product.code}</div>
  ),
}))

const product: ProductLabelData = {
  id: 1,
  code: 'REP-001',
  name: 'Repuesto',
  manufacturerCode: null,
  productBrand: null,
}

describe('ProductLabelSheet', () => {
  it('usa la cuadrícula física y conserva las celdas vacías', () => {
    const grid = calculateLabelGrid(63, 38)
    const page = buildLabelPages([{ product, quantity: 2 }], grid, 8).pages[0]!

    render(
      <ProductLabelSheet
        brand={{ displayName: 'Taller Norte', logoUrl: null }}
        grid={grid}
        page={page}
      />,
    )

    const sheet = screen.getByTestId('product-label-sheet')
    expect(sheet.getAttribute('style')).toContain('width: 210mm')
    expect(sheet.getAttribute('style')).toContain('height: 297mm')
    expect(screen.getAllByTestId('product-label-cell')).toHaveLength(21)
    expect(screen.getAllByTestId('empty-label-cell')).toHaveLength(19)
    expect(screen.getAllByTestId('rendered-label')).toHaveLength(2)
    expect(sheet.getAttribute('style')).toContain(
      'grid-template-columns: repeat(3, 63mm)',
    )
    expect(sheet.getAttribute('style')).toContain(
      'grid-template-rows: repeat(7, 38mm)',
    )
  })
})
