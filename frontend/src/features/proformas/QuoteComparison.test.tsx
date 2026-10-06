import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'

import { QuoteComparison } from './QuoteComparison'
import type { ComparisonProduct, QuoteComparison as Data } from './types'

const side = (quantity: string, price: string, total: string, rate = '15') => ({
  quantity,
  unit_price: price,
  tax_rate: rate,
  base_amount: total,
  tax_amount: '0.00',
  total_amount: total,
})

const product = (
  id: number,
  status: ComparisonProduct['status'],
  overrides: Partial<ComparisonProduct> = {},
): ComparisonProduct => ({
  product_id: id,
  product_code: `P-${id}`,
  product_name: `Producto ${id}`,
  status,
  changes: [],
  quoted: side('1', '10.00', '10.00'),
  current: side('1', '10.00', '10.00'),
  ...overrides,
})

const comparison = (products: ComparisonProduct[]): Data => ({
  products,
  totals: {
    quoted: { base: '8.70', tax: '1.30', total: '25.00' },
    current: { base: '10.43', tax: '1.57', total: '31.00' },
    difference: '6.00',
  },
  has_differences: true,
})

it('distingue con texto productos sin cambios, cambiados, retirados y agregados', () => {
  render(
    <QuoteComparison
      comparison={comparison([
        product(1, 'UNCHANGED'),
        product(2, 'CHANGED', {
          changes: ['quantity', 'unit_price'],
          quoted: side('3', '10.00', '30.00'),
          current: side('2', '12.00', '24.00'),
        }),
        product(3, 'REMOVED', { current: null }),
        product(4, 'ADDED', { quoted: null }),
      ])}
    />,
  )
  const rows = screen.getAllByRole('row').slice(1)
  expect(
    rows.map((row) => within(row).getByRole('rowheader').textContent),
  ).toEqual([
    'P-1 Producto 1',
    'P-2 Producto 2',
    'P-3 Producto 3',
    'P-4 Producto 4',
  ])
  expect(within(rows[0]!).getByText('Sin cambios')).toBeInTheDocument()
  expect(
    within(rows[1]!).getByText('Cambió cantidad, precio'),
  ).toBeInTheDocument()
  expect(within(rows[1]!).getByText('USD 12.00')).toBeInTheDocument()
  expect(within(rows[2]!).getByText('Retirado')).toBeInTheDocument()
  expect(within(rows[3]!).getByText('Agregado')).toBeInTheDocument()
})

it('muestra los totales de ambos documentos y la diferencia del servidor', () => {
  render(<QuoteComparison comparison={comparison([product(1, 'UNCHANGED')])} />)
  expect(screen.getByText('Total cotizado').nextSibling).toHaveTextContent(
    'USD 25.00',
  )
  expect(screen.getByText('Venta actual').nextSibling).toHaveTextContent(
    'USD 31.00',
  )
  expect(screen.getByText('Diferencia').nextSibling).toHaveTextContent(
    'USD 6.00',
  )
})

it('no ofrece ningún campo para editar precios', () => {
  render(<QuoteComparison comparison={comparison([product(1, 'UNCHANGED')])} />)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('spinbutton')).toBeNull()
})
