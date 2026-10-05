import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

const mocks = vi.hoisted(() => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false })
  return {
    parts: {
      isPending: false,
      isError: false,
      isSuccess: true,
      data: [] as unknown[],
    },
    summary: { isPending: false, isError: false, data: null as unknown },
    mutations: {
      addPart: mutation(),
      changePart: mutation(),
      removePart: mutation(),
      confirmServices: mutation(),
      pay: mutation(),
      voidOperation: mutation(),
      correctPayment: mutation(),
    },
    preview: vi.fn(),
  }
})

vi.mock('./billingHooks', () => ({
  useOrderParts: () => mocks.parts,
  useEconomicSummary: () => mocks.summary,
  useBillingMutations: () => mocks.mutations,
  usePartProductPicker: () => ({
    isPending: false,
    isError: false,
    data: {
      totalPages: 1,
      options: [{ id: 7, label: 'FO-100 · Filtro', detail: 'disponible 3' }],
    },
  }),
  useVoidPreview: () => ({ isPending: false, data: undefined }),
}))
vi.mock('./api', () => ({
  maintenanceApi: { previewServiceOperation: mocks.preview },
}))
vi.mock('@/features/sales/hooks', () => ({
  useSale: () => ({ data: undefined }),
  useSaleMutations: () => ({}),
}))

import { ArtisanPaymentDialog, ServiceOperationDialog } from './BillingDialogs'
import { EconomicSummary } from './EconomicSummary'
import { PartsSection } from './PartsSection'
import type { MaintenanceOrder } from './types'

function order(overrides: Partial<MaintenanceOrder> = {}): MaintenanceOrder {
  return {
    id: 9,
    number: 'ART-OT-000009',
    state: 'REGISTERED',
    version: 3,
    allowed_actions: [],
    billing_actions: ['manage_parts', 'document_services'],
    ...overrides,
  } as unknown as MaintenanceOrder
}

function sale(
  state: 'DRAFT' | 'CONFIRMED',
  extra: Record<string, unknown> = {},
) {
  return {
    id: state === 'DRAFT' ? 31 : 30,
    state,
    internal_number: state === 'DRAFT' ? null : 'COM-VEN-000030',
    lines: [
      {
        id: 101,
        position: 1,
        product_id: 7,
        product_code: 'FO-100',
        product_name: 'Filtro',
        quantity: '2',
        unit_price: '11.50',
        tax_amount: '3.00',
        total_amount: '23.00',
      },
    ],
    ...extra,
  }
}

function renderIn(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.parts.data = []
})

describe('PartsSection', () => {
  it('distingue la venta pendiente reservada de la confirmada', () => {
    mocks.parts.data = [
      sale('CONFIRMED'),
      sale('DRAFT', {
        estimate: {
          lines: [
            {
              position: 1,
              unit_price: '11.50',
              tax_amount: '3.00',
              total_amount: '23.00',
            },
          ],
          totals: { base: '20.00', tax: '3.00', total: '23.00' },
          availability: [],
        },
      }),
    ]
    renderIn(
      <PartsSection
        canOpenSales
        canSeeKardex
        onDone={vi.fn()}
        order={order()}
      />,
    )
    expect(
      screen.getByRole('link', { name: 'Kardex de Filtro' }),
    ).toHaveAttribute('href', '/inventory/products/7/kardex')
    expect(
      screen.getByText('Reservado, pendiente de confirmar'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /no descontar inventario ni generar deuda|sin descontar inventario ni generar deuda/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Confirmada: salida registrada'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/sus líneas no se modifican desde la orden/),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /Retirar Filtro/ }),
    ).toHaveLength(1)
    expect(
      screen.getByRole('link', { name: 'Ver venta y movimientos' }),
    ).toHaveAttribute('href', '/sales/30')
  })

  it('en una reapertura explica que no se agregan repuestos cobrables', () => {
    renderIn(
      <PartsSection
        canOpenSales={false}
        onDone={vi.fn()}
        order={order({ state: 'REOPENED', billing_actions: [] })}
      />,
    )
    expect(
      screen.getByText(/El trabajo correctivo no genera cobro/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Agregar repuesto' }),
    ).not.toBeInTheDocument()
  })

  it('conserva la captura y muestra la disponibilidad ante el rechazo', async () => {
    mocks.mutations.addPart.mutateAsync.mockRejectedValue(
      new ProblemError(
        'Disponibilidad insuficiente.',
        409,
        'insufficient_availability',
        undefined,
        { quantity: ['Disponible: 1.'] },
      ),
    )
    const events = userEvent.setup()
    renderIn(<PartsSection canOpenSales onDone={vi.fn()} order={order()} />)
    await events.click(screen.getByRole('button', { name: 'Agregar repuesto' }))
    await events.click(
      screen.getByRole('combobox', { name: 'Repuesto del catálogo' }),
    )
    await events.click(await screen.findByRole('option', { name: /FO-100/ }))
    const quantity = screen.getByLabelText(/Cantidad/)
    await events.clear(quantity)
    await events.type(quantity, '4')
    await events.click(
      screen.getByRole('button', { name: 'Reservar repuesto' }),
    )
    expect(await screen.findByText('Disponible: 1.')).toBeInTheDocument()
    expect(quantity).toHaveValue('4')
  })
})

describe('EconomicSummary', () => {
  it('separa los RUC, rotula el total combinado como informativo y cobra por documento', () => {
    mocks.summary.data = {
      order_id: 9,
      order_number: 'ART-OT-000009',
      commercial: {
        visible: true,
        documents: [
          {
            id: 30,
            internal_number: 'COM-VEN-000030',
            state: 'CONFIRMED',
            condition: 'CREDITO',
            grand_total: '40.00',
            paid: '0.00',
            balance: '40.00',
            payment_state: 'PENDING',
            lines: [],
            allowed_actions: ['pay'],
            can_open_sale: true,
          },
        ],
        pending: null,
        confirmed_total: '40.00',
        balance_total: '40.00',
      },
      artisan: {
        visible: true,
        documents: [
          {
            id: 4,
            internal_number: 'ART-SER-000004',
            state: 'CONFIRMED',
            condition: 'CONTADO',
            grand_total: '60.00',
            paid: '0.00',
            balance: '60.00',
            payment_state: 'PENDING',
            replaces: null,
            replaced_by: [],
            void_reason: '',
            allowed_actions: ['pay'],
          },
        ],
        pending: {
          label: 'Sin comprobante: todavía no genera deuda.',
          line_count: 1,
          estimated_total: '15.00',
        },
        confirmed_total: '60.00',
        balance_total: '60.00',
      },
      combined: {
        informative: true,
        confirmed_total: '100.00',
        pending_total: '15.00',
      },
      notice: 'Cada RUC se cobra por separado.',
    }
    renderIn(<EconomicSummary onDone={vi.fn()} order={order()} userScope="u" />)
    expect(
      screen.getByRole('button', { name: 'Cobrar repuestos (RUC comercial)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cobrar servicios (RUC artesanal)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Total combinado (informativo)'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/no es una deuda única ni una\s+factura/),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Sin comprobante: todavía no genera deuda.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Generar comprobante de servicios',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sin comprobante:')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'ART-SER-000004' }),
    ).toHaveAttribute('href', '/maintenance/service-operations/4')
  })
})

describe('Diálogos de servicios', () => {
  it('la documentación muestra importes y efectos y confirma con la huella', async () => {
    mocks.preview.mockResolvedValue({
      order_id: 9,
      order_number: 'ART-OT-000009',
      condition: 'CONTADO',
      operational_date: '2026-09-24',
      lines: [
        {
          service_line_id: 1,
          service_code: 'SRV-000012',
          service_name: 'Alineación',
          quantity: 1,
          applied_price: '23.00',
          tax_rate: '15',
          base_amount: '20.00',
          tax_amount: '3.00',
          total_amount: '23.00',
        },
      ],
      totals: { base: '20.00', tax: '3.00', total: '23.00' },
      effects: {
        series: 'ART-SER',
        creates_balance: true,
        affects_inventory: false,
        registers_payment: false,
      },
      issues: [],
      warnings: [],
      review_digest: 'digest-1',
    })
    mocks.mutations.confirmServices.mutateAsync.mockResolvedValue({
      internal_number: 'ART-SER-000001',
    })
    const onDone = vi.fn()
    const events = userEvent.setup()
    renderIn(
      <ServiceOperationDialog
        onClose={vi.fn()}
        onDone={onDone}
        order={order()}
      />,
    )
    expect(await screen.findByText('Alineación')).toBeInTheDocument()
    expect(screen.getByText('SRV-000012')).toBeInTheDocument()
    expect(
      screen.getByText(/No afecta inventario ni registra pagos/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Comprobante interno: no es una factura electrónica autorizada por el SRI\./,
      ),
    ).toBeInTheDocument()
    await events.click(
      screen.getByRole('button', { name: 'Generar comprobante' }),
    )
    await waitFor(() =>
      expect(mocks.mutations.confirmServices.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 9,
          reviewDigest: 'digest-1',
          condition: 'CONTADO',
        }),
      ),
    )
    expect(onDone).toHaveBeenCalledWith(
      'Comprobante de servicios ART-SER-000001 generado (RUC artesanal).',
    )
  })

  it('bloquea confirmar cuando la revisión informa problemas', async () => {
    mocks.preview.mockResolvedValue({
      lines: [],
      totals: null,
      effects: { series: 'ART-SER' },
      issues: [
        {
          code: 'nothing_to_document',
          message: 'No hay importe de servicios por documentar.',
        },
      ],
      warnings: [],
      review_digest: 'x',
    })
    renderIn(
      <ServiceOperationDialog
        onClose={vi.fn()}
        onDone={vi.fn()}
        order={order()}
      />,
    )
    expect(
      await screen.findByText('No hay importe de servicios por documentar.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Generar comprobante' }),
    ).toBeDisabled()
  })

  it('el cobro de servicios identifica el RUC artesanal y su saldo', async () => {
    mocks.mutations.pay.mutateAsync.mockResolvedValue({ balance: '0.00' })
    const events = userEvent.setup()
    renderIn(
      <ArtisanPaymentDialog
        onClose={vi.fn()}
        onDone={vi.fn()}
        operation={
          {
            id: 4,
            internal_number: 'ART-SER-000004',
            condition: 'CONTADO',
            balance: '60.00',
          } as never
        }
        userScope="u"
      />,
    )
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByLabelText('Ámbito fiscal: RUC artesanal'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/no se\s+aplica a los repuestos/),
    ).toBeInTheDocument()
    await events.type(within(dialog).getByLabelText('Efectivo (USD)'), '60.00')
    await events.click(
      within(dialog).getByRole('button', { name: /Registrar cobro/ }),
    )
    await waitFor(() =>
      expect(mocks.mutations.pay.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 4,
          parts: [{ method: 'EFECTIVO', amount: '60.00' }],
        }),
      ),
    )
  })
})
