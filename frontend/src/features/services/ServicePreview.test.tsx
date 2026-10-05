import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { ServicePreview } from './ServicePreview'
import type { Service } from './types'

const service: Service = {
  id: 3,
  code: 'SRV-000012',
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

it('muestra precio referencial, impuesto artesanal, estado y descripción', () => {
  render(<ServicePreview service={service} />)

  expect(screen.getByText('USD 25.00')).toBeVisible()
  expect(screen.getByText('IVA15 · IVA 15 % incluido')).toBeVisible()
  expect(screen.getByLabelText('Ámbito fiscal: RUC artesanal')).toBeVisible()
  expect(screen.getByText('Activo')).toBeVisible()
  expect(screen.getByText('Sin descripción')).toBeVisible()
})

it('advierte cuando el impuesto no tiene vigencia aplicable', () => {
  render(
    <ServicePreview
      service={{
        ...service,
        tax: { ...service.tax!, rate: null, tax_status: 'missing' },
      }}
    />,
  )
  expect(screen.getByText('Vigencia del impuesto pendiente')).toBeVisible()
})

it('muestra las fechas de registro sin la hora', () => {
  render(
    <ServicePreview
      service={{
        ...service,
        created_at: '2026-08-11T14:00:00Z',
        updated_at: '2026-09-18T20:30:00Z',
      }}
    />,
  )
  const created = screen.getByText('Creado').nextElementSibling
  expect(created).toHaveTextContent('11 ago 2026')
  expect(created?.textContent).not.toMatch(/\d:\d/)
  expect(screen.getByText('Actualizado').nextElementSibling).toHaveTextContent(
    '18 sept 2026',
  )
})

it('muestra el código del servicio como dato de solo lectura', () => {
  render(<ServicePreview service={service} />)

  const code = screen.getByText('Código').nextElementSibling
  expect(code).toHaveTextContent('SRV-000012')
  expect(screen.queryByRole('textbox')).toBeNull()
})
