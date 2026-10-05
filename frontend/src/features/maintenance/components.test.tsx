import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

const mocks = vi.hoisted(() => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false })
  return {
    finalize: mutation(),
    reopen: mutation(),
    addLine: mutation(),
    updateLine: mutation(),
    removeLine: mutation(),
    uploadPhoto: mutation(),
    removePhoto: mutation(),
    updateIntervention: mutation(),
  }
})
vi.mock('./hooks', () => ({
  useMaintenanceMutations: () => mocks,
  useServicePickerOptions: () => ({
    isPending: false,
    isError: false,
    data: { totalPages: 1, options: [] },
  }),
}))

import { OrderSummary } from './OrderSummary'
import { PhotosSection } from './Photos'
import { ServiceLinesSection } from './ServiceLines'
import { InterventionsSection, TransitionTimeline } from './Transitions'
import type { MaintenanceOrder } from './types'

const user = { id: 1, name: 'Encargado' }
const line = {
  id: 11,
  service_id: 2,
  service_code: 'SRV-000002',
  service_name: 'Ajuste de frenos',
  service_is_active: false,
  reference_price: '20.00',
  applied_price: '0.00',
  quantity: 1,
  subtotal: '0.00',
  tax_name: 'IVA',
  no_charge: true,
}

function reopened(): MaintenanceOrder {
  return {
    id: 9,
    number: 'ART-OT-000009',
    state: 'REOPENED',
    version: 7,
    fiscal_entity: { ruc: '1', legal_name: 'Taller' },
    customer: { id: 3, name: 'Ana', identification: '1', is_active: true },
    vehicle: { id: 4, plate: 'ABC', brand: 'T', model: 'H', is_active: true },
    opened_on: '2026-09-20',
    odometer_km: 1,
    odometer_confirmation: null,
    diagnosis: 'Frenos',
    notes: '',
    created_by: user,
    created_at: '2026-09-20T10:00:00Z',
    updated_by: user,
    updated_at: '2026-09-20T10:00:00Z',
    last_finalized_by: user,
    last_finalized_at: '2026-09-21T10:00:00Z',
    services_total: '120.00',
    interventions: [
      {
        id: 1,
        kind: 'INITIAL',
        ordinal: 1,
        cause: '',
        work_performed: '',
        notes: '',
        is_open: false,
        opened_by: user,
        opened_at: '2026-09-20T10:00:00Z',
        closed_by: user,
        closed_at: '2026-09-21T10:00:00Z',
        subtotal: '120.00',
        lines: [
          {
            ...line,
            id: 10,
            service_name: 'Pastillas',
            applied_price: '120.00',
            subtotal: '120.00',
            no_charge: false,
            service_is_active: true,
          },
        ],
      },
      {
        id: 2,
        kind: 'CORRECTIVE',
        ordinal: 2,
        cause: 'Ruido',
        work_performed: '',
        notes: '',
        is_open: true,
        opened_by: user,
        opened_at: '2026-09-22T10:00:00Z',
        closed_by: null,
        closed_at: null,
        subtotal: '0.00',
        lines: [line],
      },
    ],
    photos: [
      {
        id: 5,
        intervention_id: 1,
        description: 'Antes',
        content_type: 'image/jpeg',
        size_bytes: 1,
        width: 1,
        height: 1,
        uploaded_by: user,
        uploaded_at: '2026-09-20T10:00:00Z',
        file_url: '/f/5',
        thumbnail_url: '/t/5',
      },
      {
        id: 6,
        intervention_id: 2,
        description: '',
        content_type: 'image/jpeg',
        size_bytes: 1,
        width: 1,
        height: 1,
        uploaded_by: user,
        uploaded_at: '2026-09-22T10:00:00Z',
        file_url: '/f/6',
        thumbnail_url: '/t/6',
      },
    ],
    transitions: [
      {
        id: 1,
        from_state: 'REGISTERED',
        to_state: 'FINALIZED',
        reason: '',
        actor: user,
        occurred_at: '2026-09-21T10:00:00Z',
        intervention_id: 1,
      },
      {
        id: 2,
        from_state: 'FINALIZED',
        to_state: 'REOPENED',
        reason: 'Ruido',
        actor: user,
        occurred_at: '2026-09-22T10:00:00Z',
        intervention_id: 2,
      },
    ],
    pending_requirements: [
      { code: 'work_performed', message: 'Registre el trabajo.' },
    ],
    allowed_actions: [
      'edit_intervention',
      'manage_services',
      'manage_photos',
      'finalize',
    ],
  }
}

const onDone = vi.fn()
const wrap = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('servicios de una orden reabierta', () => {
  it('bloquea la intervención inicial y marca la correctiva sin cargo', () => {
    wrap(<ServiceLinesSection onDone={onDone} order={reopened()} />)
    expect(screen.getByText('Intervención inicial')).toBeInTheDocument()
    expect(
      screen.getByText(/Intervención correctiva 1 · sin cargo/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Editar Pastillas' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Editar Ajuste de frenos' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sin cargo')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Agregar servicio sin cargo/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('Inactivo en catálogo')).toBeInTheDocument()
  })

  it('edita la cantidad sin permitir precio en la correctiva', async () => {
    const u = userEvent.setup()
    mocks.updateLine.mutateAsync.mockResolvedValue(reopened())
    wrap(<ServiceLinesSection onDone={onDone} order={reopened()} />)
    await u.click(
      screen.getByRole('button', { name: 'Editar Ajuste de frenos' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByLabelText('Precio aplicado a esta orden (USD)'),
    ).toBeDisabled()
    const quantity = within(dialog).getByLabelText('Cantidad')
    await u.clear(quantity)
    await u.type(quantity, '0')
    await u.click(
      within(dialog).getByRole('button', { name: 'Guardar servicio' }),
    )
    expect(
      within(dialog).getByText(
        'La cantidad debe ser un entero entre 1 y 9999.',
      ),
    ).toBeInTheDocument()
    await u.clear(quantity)
    await u.type(quantity, '2')
    await u.click(
      within(dialog).getByRole('button', { name: 'Guardar servicio' }),
    )
    await waitFor(() =>
      expect(mocks.updateLine.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 9,
          lineId: 11,
          data: { quantity: 2 },
          expectedVersion: 7,
        }),
      ),
    )
    expect(onDone).toHaveBeenCalledWith(
      'Servicio «Ajuste de frenos» actualizado.',
    )
  })

  it('retira una línea tras confirmar y muestra errores del servidor', async () => {
    const u = userEvent.setup()
    mocks.removeLine.mutateAsync
      .mockRejectedValueOnce(
        new ProblemError('La orden cambió.', 409, 'stale_record'),
      )
      .mockResolvedValueOnce(reopened())
    wrap(<ServiceLinesSection onDone={onDone} order={reopened()} />)
    await u.click(
      screen.getByRole('button', { name: 'Retirar Ajuste de frenos' }),
    )
    await u.click(
      await screen.findByRole('button', { name: 'Retirar servicio' }),
    )
    expect(
      await screen.findByText('No se retiró el servicio'),
    ).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Retirar servicio' }))
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith(
        'Servicio «Ajuste de frenos» retirado de la orden.',
      ),
    )
  })
})

describe('servicios documentados en una operación artesanal', () => {
  it('rotula la documentación y bloquea la edición de la línea documentada', () => {
    const base = reopened()
    const initial = base.interventions.find((i) => i.kind === 'INITIAL')!
    const documented = {
      ...base,
      state: 'REGISTERED' as const,
      interventions: [
        {
          ...initial,
          is_open: true,
          lines: [
            {
              ...line,
              id: 20,
              service_name: 'Alineación',
              no_charge: false,
              documented_by: { id: 4, number: 'ART-SER-000004' },
            },
            {
              ...line,
              id: 21,
              service_name: 'Balanceo',
              no_charge: false,
              documented_by: null,
            },
          ],
        },
      ],
    }
    wrap(<ServiceLinesSection onDone={onDone} order={documented} />)
    expect(
      screen.getByText('En comprobante ART-SER-000004'),
    ).toBeInTheDocument()
    expect(screen.getByText('Sin comprobante')).toBeInTheDocument()
    expect(screen.getAllByText('SRV-000002')).toHaveLength(2)
    expect(
      screen.queryByRole('button', { name: 'Editar Alineación' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText('Bloqueada: incluida en un comprobante'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Editar Balanceo' }),
    ).toBeInTheDocument()
  })
})

describe('fotografías', () => {
  it('solo permite retirar las de la intervención abierta y amplía la imagen', async () => {
    const u = userEvent.setup()
    mocks.removePhoto.mutateAsync.mockResolvedValue(reopened())
    wrap(<PhotosSection onDone={onDone} order={reopened()} />)
    expect(
      screen.queryByRole('button', { name: 'Retirar Antes' }),
    ).not.toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Ver Antes' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByAltText('Antes')).toHaveAttribute('src', '/f/5')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await u.click(screen.getByRole('button', { name: 'Retirar Fotografía 2' }))
    await u.click(
      await screen.findByRole('button', { name: 'Retirar fotografía' }),
    )
    await waitFor(() =>
      expect(mocks.removePhoto.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ id: 9, photoId: 6 }),
      ),
    )
  })

  it('rechaza en el navegador tipos y tamaños no admitidos', async () => {
    const u = userEvent.setup({ applyAccept: false })
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    wrap(<PhotosSection onDone={onDone} order={reopened()} />)
    await u.click(screen.getByRole('button', { name: /Adjuntar fotografía/ }))
    const dialog = await screen.findByRole('dialog')
    const input = within(dialog).getByLabelText('Imagen')
    await u.upload(
      input,
      new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }),
    )
    expect(
      within(dialog).getByText('Seleccione una imagen JPEG, PNG o WebP.'),
    ).toBeInTheDocument()
    const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
    await u.upload(input, big)
    expect(
      within(dialog).getByText('La imagen supera el máximo de 10 MiB.'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Adjuntar' }),
    ).toBeDisabled()
    expect(mocks.uploadPhoto.mutateAsync).not.toHaveBeenCalled()
  })
})

describe('intervención correctiva e historial', () => {
  it('guarda el trabajo correctivo y muestra errores', async () => {
    const u = userEvent.setup()
    mocks.updateIntervention.mutateAsync
      .mockRejectedValueOnce(
        new ProblemError('La orden cambió.', 409, 'stale_record'),
      )
      .mockResolvedValueOnce(reopened())
    wrap(<InterventionsSection onDone={onDone} order={reopened()} />)
    expect(screen.getByText('Ruido')).toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'Guardar corrección' })
    expect(save).toBeDisabled()
    expect(
      screen.getByRole('heading', { name: 'Corrección 1 en curso' }),
    ).toBeInTheDocument()
    const steps = screen.getByRole('list', { name: 'Pasos de la corrección' })
    expect(within(steps).getByText('Trabajo correctivo')).toHaveTextContent(
      '(pendiente)',
    )
    expect(within(steps).getByText('Servicios sin cargo')).toHaveTextContent(
      '(completo)',
    )
    expect(screen.getByText('Sin cambios pendientes.')).toBeInTheDocument()
    await u.type(
      screen.getByLabelText('Trabajo correctivo realizado'),
      'Ajuste',
    )
    await u.click(save)
    expect(
      await screen.findByText('No se guardó la intervención'),
    ).toBeInTheDocument()
    await u.click(save)
    await waitFor(() =>
      expect(mocks.updateIntervention.mutateAsync).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: 9,
          data: { work_performed: 'Ajuste', notes: '' },
          expectedVersion: 7,
        }),
      ),
    )
    expect(onDone).toHaveBeenCalledWith('Intervención correctiva guardada.')
  })

  it('muestra las correcciones cerradas en solo lectura', () => {
    const order = reopened()
    order.interventions[1] = {
      ...order.interventions[1]!,
      is_open: false,
      work_performed: 'Ajuste hecho',
      notes: 'Sin costo',
      closed_at: '2026-09-23T10:00:00Z',
    }
    order.allowed_actions = ['reopen']
    wrap(<InterventionsSection onDone={onDone} order={order} />)
    expect(screen.getByText('Ajuste hecho')).toBeInTheDocument()
    expect(screen.getByText('Sin costo')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Guardar corrección' }),
    ).not.toBeInTheDocument()
  })

  it('el historial conserva finalizaciones y reaperturas con su causa', () => {
    wrap(<TransitionTimeline order={reopened()} />)
    expect(screen.getByText('Orden registrada')).toBeInTheDocument()
    expect(screen.getByText('Registrada → Finalizada')).toBeInTheDocument()
    expect(screen.getByText('Finalizada → Reabierta')).toBeInTheDocument()
    expect(screen.getByText('Causa: Ruido')).toBeInTheDocument()
  })
})

describe('resumen de la orden', () => {
  it('lista los requisitos de la intervención abierta con su estado', () => {
    wrap(<OrderSummary order={reopened()} />)
    const list = screen.getByRole('list', { name: 'Requisitos para finalizar' })
    expect(
      within(list).getByText(/Trabajo correctivo registrado/),
    ).toHaveTextContent('(pendiente)')
    expect(screen.getByText('USD 120.00')).toBeInTheDocument()
  })

  it('una orden finalizada muestra quién la cerró en lugar de requisitos', () => {
    const order = reopened()
    order.state = 'FINALIZED'
    order.interventions = order.interventions.map((i) => ({
      ...i,
      is_open: false,
    }))
    wrap(<OrderSummary order={order} />)
    expect(
      screen.queryByRole('list', { name: 'Requisitos para finalizar' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Finalizada por Encargado/)).toBeInTheDocument()
  })
})
