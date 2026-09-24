import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { ServiceDetails } from './ServiceDetails'
import type { Service } from './types'

const service: Service = {
  id: 3,
  name: 'Alineación',
  description: '',
  reference_price: '25.00',
  tax: {
    id: 1,
    code: 'IVA15',
    name: 'IVA',
    entity_type: 'ARTESANAL',
    rate: '15.00',
    tax_status: 'applicable',
  },
  is_active: true,
  version: 4,
  created_at: '',
  updated_at: '',
}

it('separa los datos del servicio del precio referencial con su impuesto artesanal', () => {
  render(<ServiceDetails service={service} />)

  const data = screen.getByRole('region', { name: 'Datos del servicio' })
  expect(data).toHaveTextContent('Alineación')
  expect(data).toHaveTextContent('Sin descripción')

  const price = screen.getByRole('region', { name: 'Precio referencial' })
  expect(price).toHaveTextContent('USD 25.00')
  expect(price).toHaveTextContent('IVA15 · IVA 15 % incluido')
  expect(screen.getByLabelText('Ámbito fiscal: RUC artesanal')).toBeVisible()
})

it('advierte cuando el impuesto no tiene vigencia aplicable', () => {
  render(
    <ServiceDetails
      service={{
        ...service,
        tax: { ...service.tax!, rate: null, tax_status: 'missing' },
      }}
    />,
  )
  expect(screen.getByText('Vigencia del impuesto pendiente')).toBeVisible()
})
