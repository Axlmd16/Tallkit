import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

const mocks = vi.hoisted(() => ({ taxes: {} as Record<string, unknown> }))

vi.mock('./hooks', () => ({ useServiceTaxOptions: () => mocks.taxes }))

import { ServiceForm } from './ServiceForm'
import type { Service } from './types'

const tax = {
  id: 4,
  code: 'ART',
  name: 'Artesanal 0',
  entity_type: 'ARTESANAL' as const,
  rate: '0.0000',
  tax_status: 'applicable' as const,
}
const taxPage = (results: unknown[]) => ({
  isPending: false,
  isSuccess: true,
  data: {
    count: results.length,
    page: 1,
    page_size: 100,
    total_pages: 1,
    results,
  },
})

const service: Service = {
  id: 2,
  name: 'Alineación',
  description: '',
  reference_price: '25.00',
  tax,
  is_active: true,
  version: 2,
  created_at: '',
  updated_at: '',
}

beforeEach(() => {
  mocks.taxes = taxPage([tax])
})

it('acepta precio cero y envía el importe como texto con su explicación de ajuste', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<ServiceForm onCancel={vi.fn()} onSubmit={onSubmit} />)
  expect(
    screen.getByText(/puede ajustarse al confirmar cada mantenimiento/i),
  ).toBeInTheDocument()

  await user.type(screen.getByLabelText(/^nombre/i), 'Diagnóstico')
  await user.type(
    screen.getByLabelText(/precio referencial final \(usd\)/i),
    '0',
  )
  await user.selectOptions(screen.getByLabelText(/impuesto/i), '4')
  await user.click(screen.getByRole('button', { name: /guardar servicio/i }))

  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Diagnóstico',
      reference_price: '0',
      tax_definition_id: 4,
    }),
  )
})

it('rechaza exceso de decimales conservando el texto y sin redondear', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<ServiceForm onCancel={vi.fn()} onSubmit={onSubmit} />)
  await user.type(screen.getByLabelText(/^nombre/i), 'X')
  await user.type(screen.getByLabelText(/precio referencial final/i), '12.345')
  await user.selectOptions(screen.getByLabelText(/impuesto/i), '4')
  await user.click(screen.getByRole('button', { name: /guardar servicio/i }))
  expect(
    await screen.findByText(/hasta 12 enteros y 2 decimales/i),
  ).toBeInTheDocument()
  expect(screen.getByLabelText(/precio referencial final/i)).toHaveValue(
    '12.345',
  )
  expect(onSubmit).not.toHaveBeenCalled()
})

it('en edición envía solo el campo cambiado', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(
    <ServiceForm onCancel={vi.fn()} onSubmit={onSubmit} service={service} />,
  )
  await user.clear(screen.getByLabelText(/precio referencial final/i))
  await user.type(screen.getByLabelText(/precio referencial final/i), '30.00')
  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({ reference_price: '30.00' }),
  )
})

it('informa la configuración tributaria pendiente del ámbito artesanal', () => {
  mocks.taxes = taxPage([])
  render(<ServiceForm onCancel={vi.fn()} onSubmit={vi.fn()} />)
  expect(
    screen.getByText(/definiciones de impuesto del ruc artesanal/i),
  ).toBeInTheDocument()
})

it('muestra una definición no válida devuelta por el servidor en su campo', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockRejectedValue(
    new ProblemError(
      'Ámbito tributario inválido.',
      400,
      'invalid_tax_scope',
      'r',
      {
        tax_definition_id: ['La definición pertenece a otro ámbito fiscal.'],
      },
    ),
  )
  render(
    <ServiceForm onCancel={vi.fn()} onSubmit={onSubmit} service={service} />,
  )
  await user.clear(screen.getByLabelText(/^nombre/i))
  await user.type(screen.getByLabelText(/^nombre/i), 'Alineación 3D')
  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
  expect(
    await screen.findByText('La definición pertenece a otro ámbito fiscal.'),
  ).toBeInTheDocument()
  expect(screen.getByLabelText(/^nombre/i)).toHaveValue('Alineación 3D')
})

it('un servicio nuevo parte con el primer impuesto seleccionado sin marcarse como modificado', async () => {
  const other = { ...tax, id: 9, code: 'ART2', name: 'Artesanal 15' }
  mocks.taxes = taxPage([tax, other])
  const onDirtyChange = vi.fn()
  render(
    <ServiceForm
      onCancel={vi.fn()}
      onDirtyChange={onDirtyChange}
      onSubmit={vi.fn()}
    />,
  )

  await waitFor(() =>
    expect(screen.getByLabelText(/impuesto/i)).toHaveValue('4'),
  )
  expect(onDirtyChange).not.toHaveBeenCalledWith(true)
})

it('al editar conserva el impuesto del servicio aunque no sea el primero', () => {
  const other = { ...tax, id: 9, code: 'ART2', name: 'Artesanal 15' }
  mocks.taxes = taxPage([tax, other])
  render(
    <ServiceForm
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
      service={{ ...service, tax: other }}
    />,
  )
  expect(screen.getByLabelText(/impuesto/i)).toHaveValue('9')
})
