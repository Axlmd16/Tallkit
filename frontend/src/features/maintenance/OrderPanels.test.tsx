import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ update: vi.fn() }))
vi.mock('./hooks', () => ({
  useMaintenanceMutations: () => ({
    update: { mutateAsync: mocks.update, isPending: false },
  }),
}))

import {
  collectionStatus,
  finalizeChecks,
  FinalizeCard,
  MovesLog,
  NotesCard,
} from './OrderPanels'
import { lifecycleText, sinceText } from './OrderBand'
import type { MaintenanceOrder } from './types'

const user = { id: 1, name: 'Ana' }

function order(overrides: Partial<MaintenanceOrder> = {}): MaintenanceOrder {
  return {
    id: 9,
    number: 'ART-OT-000009',
    state: 'REGISTERED',
    version: 4,
    opened_on: '2026-11-14',
    created_at: '2026-11-14T14:40:00Z',
    created_by: user,
    last_finalized_at: null,
    notes: 'Pide el cliente: Frenos.\nAvisar por WhatsApp.',
    diagnosis: '',
    interventions: [
      {
        id: 1,
        kind: 'INITIAL',
        ordinal: 1,
        is_open: true,
        lines: [{ id: 1 }],
      },
    ],
    transitions: [],
    pending_requirements: [],
    allowed_actions: ['finalize', 'edit'],
    ...overrides,
  } as unknown as MaintenanceOrder
}

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

beforeEach(() => vi.clearAllMocks())

it('los pasos para finalizar salen de lo que el servidor reporta como pendiente', () => {
  const pending = order({
    pending_requirements: [
      { code: 'diagnosis', message: 'x' },
      { code: 'pending_parts', message: 'y' },
    ],
  })
  expect(finalizeChecks(pending).map((c) => [c.title, c.ok])).toEqual([
    ['Diagnóstico escrito', false],
    ['Al menos un trabajo', true],
    ['Repuestos sin confirmar', false],
  ])
  expect(finalizeChecks(order()).every((c) => c.ok)).toBe(true)
})

it('en una corrección el único paso es describir lo que se hizo', () => {
  const correction = order({
    state: 'REOPENED',
    interventions: [
      { id: 2, kind: 'CORRECTIVE', ordinal: 2, is_open: true, lines: [] },
    ] as never,
    pending_requirements: [{ code: 'work_performed', message: 'z' }],
  })
  expect(finalizeChecks(correction)).toEqual([
    expect.objectContaining({ title: 'Corrección descrita', ok: false }),
  ])
})

it('«Finalizar» se habilita solo con todos los pasos completos y quien puede finalizar', async () => {
  const u = userEvent.setup()
  const onFinalize = vi.fn()
  const view = wrap(
    <FinalizeCard
      onFinalize={onFinalize}
      order={order({
        pending_requirements: [{ code: 'diagnosis', message: 'x' }],
      })}
    />,
  )
  expect(
    screen.getByRole('button', { name: 'Finalizar mantenimiento' }),
  ).toBeDisabled()
  view.unmount()

  wrap(<FinalizeCard onFinalize={onFinalize} order={order()} />)
  expect(screen.getByText('3 de 3')).toBeInTheDocument()
  await u.click(screen.getByRole('button', { name: 'Finalizar mantenimiento' }))
  expect(onFinalize).toHaveBeenCalledTimes(1)
})

it('sin permiso de finalizar no se ofrece el botón', () => {
  wrap(
    <FinalizeCard
      onFinalize={vi.fn()}
      order={order({ allowed_actions: ['edit'] })}
    />,
  )
  expect(
    screen.queryByRole('button', { name: /Finalizar/ }),
  ).not.toBeInTheDocument()
})

it('el estado del cobro se resume sin mezclar documentos anulados', () => {
  expect(collectionStatus([])).toEqual({ label: 'Sin cobrar', tone: 'neutral' })
  const doc = (state: string, payment: string) =>
    ({ state, payment_state: payment }) as never
  expect(
    collectionStatus([doc('CONFIRMED', 'PAID'), doc('VOIDED', 'PENDING')])
      .label,
  ).toBe('Cobrado')
  expect(
    collectionStatus([doc('CONFIRMED', 'PAID'), doc('CONFIRMED', 'PENDING')])
      .label,
  ).toBe('Cobro parcial')
  expect(collectionStatus([doc('CONFIRMED', 'PENDING')]).label).toBe(
    'Sin cobrar',
  )
})

it('los movimientos cuentan la apertura, la finalización y la reapertura con su causa', () => {
  wrap(
    <MovesLog
      order={order({
        transitions: [
          {
            id: 1,
            from_state: 'REGISTERED',
            to_state: 'FINALIZED',
            reason: '',
            actor: user,
            occurred_at: '2026-11-14T16:00:00Z',
            intervention_id: 1,
          },
          {
            id: 2,
            from_state: 'FINALIZED',
            to_state: 'REOPENED',
            reason: 'Sigue el ruido',
            actor: user,
            occurred_at: '2026-11-15T13:00:00Z',
            intervention_id: 2,
          },
        ],
      })}
    />,
  )
  const log = screen.getByRole('region', { name: 'Movimientos de esta orden' })
  expect(within(log).getByText(/Abierto por Ana/)).toBeInTheDocument()
  expect(within(log).getByText(/Finalizado por Ana/)).toBeInTheDocument()
  expect(
    within(log).getByText(/Reabierto por Ana: Sigue el ruido/),
  ).toBeInTheDocument()
})

it('observaciones muestra solo el texto libre y al guardar conserva lo que pidió el cliente', async () => {
  const u = userEvent.setup()
  mocks.update.mockResolvedValue(order())
  wrap(<NotesCard editable order={order()} />)
  const box = screen.getByRole('textbox', { name: 'Observaciones' })
  expect(box).toHaveValue('Avisar por WhatsApp.')
  await u.type(box, ' Antes de las 5.')
  await u.tab()
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9,
        expectedVersion: 4,
        data: {
          notes:
            'Pide el cliente: Frenos.\nAvisar por WhatsApp. Antes de las 5.',
        },
      }),
    ),
  )
})

it('observaciones no se guarda sin cambios ni sin permiso de editar', async () => {
  const u = userEvent.setup()
  const view = wrap(<NotesCard editable order={order()} />)
  await u.click(screen.getByRole('textbox', { name: 'Observaciones' }))
  await u.tab()
  expect(mocks.update).not.toHaveBeenCalled()
  view.unmount()
  wrap(<NotesCard editable={false} order={order()} />)
  expect(
    screen.getByRole('textbox', { name: 'Observaciones' }),
  ).toHaveAttribute('readonly')
})

it('el ciclo de la orden dice desde cuándo está abierta y cuándo se finalizó o reabrió', () => {
  expect(sinceText(order())).toMatch(/^Desde 14\/11\/2026 a las 09:40$/)
  expect(
    lifecycleText(
      order({ state: 'FINALIZED', last_finalized_at: '2026-11-14T16:00:00Z' }),
    ),
  ).toMatch(/finalizada/)
  expect(
    lifecycleText(
      order({
        state: 'REOPENED',
        last_finalized_at: '2026-11-14T16:00:00Z',
        transitions: [
          { id: 2, to_state: 'REOPENED', occurred_at: '2026-11-15T13:00:00Z' },
        ] as never,
      }),
    ),
  ).toMatch(/reabierta/)
})
