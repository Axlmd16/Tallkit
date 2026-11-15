import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  addLine: vi.fn(),
  addPart: vi.fn(),
  services: [] as unknown[],
  parts: [] as unknown[],
}))

vi.mock('./hooks', () => ({
  useMaintenanceMutations: () => ({
    addLine: { mutateAsync: mocks.addLine },
  }),
  useServiceSearch: () => ({
    isPending: false,
    data: { results: mocks.services },
  }),
}))
vi.mock('./billingHooks', () => ({
  useBillingMutations: () => ({ addPart: { mutateAsync: mocks.addPart } }),
  usePartSearch: () => ({
    isPending: false,
    data: { results: mocks.parts },
  }),
}))

import type { MaintenanceOrder } from './types'
import { PartAdder, ServiceAdder } from './WorkSearch'

const order = { id: 9, version: 3 } as MaintenanceOrder

function renderServices(corrective = false) {
  return render(
    <ToastProvider>
      <ServiceAdder corrective={corrective} order={order} />
    </ToastProvider>,
  )
}
function renderParts() {
  return render(
    <ToastProvider>
      <PartAdder order={order} />
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.services = [
    {
      id: 2,
      name: 'Cambio de aceite',
      description: '',
      reference_price: '15.00',
    },
  ]
  mocks.parts = [
    {
      id: 7,
      code: 'FO-100',
      name: 'Filtro de aceite',
      sale_price: '11.50',
      available: '3',
    },
  ]
})

async function type(label: string, text: string) {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: label }), text)
  return user
}

it('ofrece los servicios que coinciden, con su precio referencial', async () => {
  renderServices()
  await type('Agregar trabajo', 'aceite')
  expect(
    await screen.findByRole('button', { name: 'Agregar Cambio de aceite' }),
  ).toHaveTextContent('USD 15.00')
})

it('agrega un servicio con cantidad uno y limpia el texto', async () => {
  mocks.addLine.mockResolvedValue({})
  renderServices()
  const user = await type('Agregar trabajo', 'aceite')
  await user.click(
    await screen.findByRole('button', { name: 'Agregar Cambio de aceite' }),
  )
  await waitFor(() =>
    expect(mocks.addLine).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9,
        data: { service_id: 2, quantity: 1 },
        expectedVersion: 3,
      }),
    ),
  )
  expect(
    await screen.findByText('Servicio «Cambio de aceite» agregado.'),
  ).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Agregar trabajo' })).toHaveValue(
    '',
  )
})

it('en una corrección el buscador anuncia que el trabajo va sin cargo', () => {
  renderServices(true)
  expect(screen.getByPlaceholderText(/Agregar trabajo sin cargo/)).toBeVisible()
})

it('reserva un repuesto y, si el servidor lo rechaza, muestra el motivo y conserva lo escrito', async () => {
  mocks.addPart.mockRejectedValue(
    new ProblemError('Disponibilidad insuficiente.', 409, 'insufficient'),
  )
  renderParts()
  const user = await type('Agregar repuesto', 'filtro')
  await user.click(
    await screen.findByRole('button', { name: 'Agregar Filtro de aceite' }),
  )
  expect(mocks.addPart).toHaveBeenCalledWith(
    expect.objectContaining({ id: 9, productId: 7, quantity: '1' }),
  )
  expect(await screen.findByText('Disponibilidad insuficiente.')).toBeVisible()
  expect(screen.getByRole('textbox', { name: 'Agregar repuesto' })).toHaveValue(
    'filtro',
  )
})

it('un repuesto muestra su código y su disponibilidad', async () => {
  renderParts()
  await type('Agregar repuesto', 'filtro')
  expect(
    await screen.findByRole('button', { name: 'Agregar Filtro de aceite' }),
  ).toHaveTextContent('FO-100 · disponible 3')
})

it('avisa cuando nada coincide', async () => {
  mocks.services = []
  renderServices()
  await type('Agregar trabajo', 'zzz')
  expect(await screen.findByText('Nada coincide con lo escrito.')).toBeVisible()
})
