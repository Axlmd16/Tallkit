import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  filters: [] as unknown[],
  state: {} as Record<string, unknown>,
}))

const event = {
  id: 1,
  actor: { id: 2, username: 'admin' },
  action: 'user.roles_changed',
  target_type: 'user',
  target_id: '4',
  result: 'SUCCESS',
  occurred_at: '2026-09-09T15:30:00-05:00',
  reason: null,
  request_id: 'request-id',
  operation_id: null,
  metadata: { changed_fields: ['roles'] },
}

vi.mock('@/features/audit/hooks', () => ({
  useAudit: (filters: unknown) => {
    mocks.filters.push(filters)
    return mocks.state
  },
}))

import { AuditPage } from './AuditPage'

beforeEach(() => {
  mocks.filters = []
  mocks.state = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: { results: [event], page: 2, total_pages: 3 },
  }
})

it('shows the business timezone and sanitized event detail', async () => {
  const user = userEvent.setup()
  render(<AuditPage />)
  expect(screen.getAllByText(/9 sept 2026/)).not.toHaveLength(0)
  await user.click(screen.getAllByRole('button', { name: 'Ver' })[0]!)
  expect(
    screen.getByRole('dialog', { name: 'Detalle del evento' }),
  ).toHaveTextContent('request-id')
  expect(screen.getByRole('dialog')).toHaveTextContent('changed_fields')
  await user.click(screen.getByRole('button', { name: 'Cerrar detalle' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('offers comparable desktop data and prioritized narrow-screen detail', () => {
  render(<AuditPage />)

  expect(
    screen.getByRole('table', { name: 'Eventos de auditoría' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('list', {
      name: 'Eventos de auditoría en pantalla estrecha',
    }),
  ).toBeInTheDocument()
})

it('applies filters and pagination controls', async () => {
  const user = userEvent.setup()
  render(<AuditPage />)
  await user.type(screen.getByLabelText('Usuario'), '2')
  await user.type(screen.getByLabelText('Acción'), 'login')
  await user.selectOptions(screen.getByLabelText('Resultado'), 'DENIED')
  await user.type(screen.getByLabelText('Tipo de objeto'), 'user')
  await user.type(screen.getByLabelText('ID del objeto'), '42')
  await user.click(screen.getByRole('button', { name: 'Página anterior' }))
  await user.click(screen.getByRole('button', { name: 'Página siguiente' }))
  expect(mocks.filters.at(-1)).toMatchObject({
    user: '2',
    action: 'login',
    result: 'DENIED',
    targetType: 'user',
    targetId: '42',
    page: 1,
  })
})

it('displays registry events with transfer metadata in detail modal', async () => {
  const user = userEvent.setup()
  const transferEvent = {
    id: 10,
    actor: { id: 3, username: 'encargado' },
    action: 'registry.vehicle_owner_changed',
    target_type: 'vehicle',
    target_id: '42',
    result: 'SUCCESS',
    occurred_at: '2026-09-09T16:00:00-05:00',
    reason: null,
    request_id: 'req-transfer-123',
    operation_id: null,
    metadata: {
      previous_owner_id: 101,
      new_owner_id: 102,
      path: '/api/v1/vehicles/42/transfer/',
    },
  }
  mocks.state = {
    isPending: false,
    isError: false,
    isSuccess: true,
    data: { results: [transferEvent], page: 1, total_pages: 1 },
  }
  render(<AuditPage />)

  // Shows friendly action label in table
  expect(screen.getAllByText('Transferencia de propiedad')).not.toHaveLength(0)
  expect(
    screen.getAllByText('registry.vehicle_owner_changed'),
  ).not.toHaveLength(0)

  // Open detail
  await user.click(screen.getAllByRole('button', { name: 'Ver' })[0]!)
  const dialog = screen.getByRole('dialog', { name: 'Detalle del evento' })
  expect(dialog).toHaveTextContent('Vehículo #42')
  expect(dialog).toHaveTextContent('Propietario anterior (ID)')
  expect(dialog).toHaveTextContent('101')
  expect(dialog).toHaveTextContent('Nuevo propietario (ID)')
  expect(dialog).toHaveTextContent('102')
  expect(dialog).toHaveTextContent('/api/v1/vehicles/42/transfer/')
})

it.each([
  [
    { isPending: true, isError: false, isSuccess: false },
    'Cargando auditoría…',
  ],
  [
    { isPending: false, isError: true, isSuccess: false },
    'No fue posible consultar la auditoría.',
  ],
  [
    {
      isPending: false,
      isError: false,
      isSuccess: true,
      data: { results: [], page: 1, total_pages: 0 },
    },
    'No existen eventos para estos filtros.',
  ],
])('renders remote state %#', (state, message) => {
  mocks.state = state
  render(<AuditPage />)
  expect(screen.getByText(message)).toBeInTheDocument()
})
