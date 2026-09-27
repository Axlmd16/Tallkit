import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false })
  return {
    permissions: [] as string[],
    operation: { isPending: false, isError: false, data: undefined as unknown },
    receivables: {
      isPending: false,
      isError: false,
      data: undefined as unknown,
    },
    commercial: {
      isPending: false,
      isError: false,
      data: undefined as unknown,
    },
    brands: {} as Record<
      string,
      { logoUrl: string | null; legalName?: string }
    >,
    scopes: [] as string[],
    mutations: {
      pay: mutation(),
      voidOperation: mutation(),
      correctPayment: mutation(),
    },
  }
})

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({
    data: { username: 'u', permissions: mocks.permissions },
  }),
}))
vi.mock('@/shared/api/entity-logos', () => ({
  useIssuerBrand: (scope: string) => {
    mocks.scopes.push(scope)
    return mocks.brands[scope] ?? { logoUrl: null, legalName: undefined }
  },
}))
vi.mock('@/features/maintenance/billingHooks', () => ({
  useServiceOperation: () => mocks.operation,
  useServiceOperationDocument: () => mocks.operation,
  useArtisanReceivables: () => mocks.receivables,
  useCommercialView: () => mocks.commercial,
  useBillingMutations: () => mocks.mutations,
  useVoidPreview: () => ({ isPending: false, data: undefined }),
}))

import { ArtisanReceivablesPage } from './ArtisanReceivablesPage'
import { CommercialOrderViewPage } from './CommercialOrderViewPage'
import { ServiceOperationDetailPage } from './ServiceOperationDetailPage'
import { ServiceOperationDocumentPage } from './ServiceOperationDocumentPage'

const user = { id: 1, name: 'Encargado' }

function operation(overrides: Record<string, unknown> = {}) {
  return {
    id: 4,
    internal_number: 'ART-SER-000004',
    order_id: 9,
    order_number: 'ART-OT-000009',
    state: 'CONFIRMED',
    condition: 'CREDITO',
    operational_date: '2026-09-24',
    customer_snapshot: { name: 'Ana Pérez', identification: '1712345678' },
    vehicle_snapshot: { plate: 'ABC-1234', brand: 'Toyota', model: 'Hilux' },
    fiscal_snapshot: {
      entity: {
        type: 'ARTESANAL',
        ruc: '1790000000002',
        legal_name: 'Taller Artesanal',
      },
      series_code: 'ART-SER',
    },
    grand_total: '60.00',
    base_total: '52.17',
    tax_total: '7.83',
    paid: '20.00',
    balance: '40.00',
    payment_state: 'PARTIAL',
    replaces: { id: 3, internal_number: 'ART-SER-000003' },
    replaced_by: [],
    void_reason: '',
    version: 2,
    allowed_actions: ['pay', 'void'],
    lines: [
      {
        id: 1,
        service_line_id: 10,
        position: 1,
        service_id: 2,
        service_name: 'Alineación',
        quantity: 1,
        reference_price: '60.00',
        applied_price: '60.00',
        tax_name: 'IVA servicios',
        tax_rate: '15.0000',
        base_amount: '52.17',
        tax_amount: '7.83',
        total_amount: '60.00',
      },
    ],
    payments: [
      {
        id: 7,
        operation_id: 'u-1',
        amount: '20.00',
        effective_at: '2026-09-24T10:00:00Z',
        effective_date: '2026-09-24',
        created_by: user,
        status: 'EFFECTIVE',
        parts: [{ method: 'EFECTIVO', amount: '20.00' }],
        correction: null,
      },
    ],
    created_by: user,
    created_at: '2026-09-24T10:00:00Z',
    voided_by: null,
    voided_at: null,
    fiscal_notice:
      'Documento interno: no constituye factura electrónica autorizada por el SRI.',
    ...overrides,
  }
}

function renderAt(path: string, pattern: string, element: React.ReactElement) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={element} path={pattern} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions = []
})

describe('ServiceOperationDetailPage', () => {
  it('muestra RUC artesanal, saldo, líneas, cobros y reemplazo con sus acciones', () => {
    mocks.operation.data = operation()
    renderAt(
      '/maintenance/service-operations/4',
      '/maintenance/service-operations/:id',
      <ServiceOperationDetailPage />,
    )
    expect(
      screen.getByRole('heading', { name: 'ART-SER-000004' }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Ámbito fiscal: RUC artesanal'),
    ).toBeInTheDocument()
    const balance = screen.getByLabelText('Saldo de la operación')
    expect(within(balance).getByText('Saldo')).toBeInTheDocument()
    expect(screen.getByText('Alineación')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'ART-SER-000003' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Vigente')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cobrar servicios (RUC artesanal)' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anular' })).toBeInTheDocument()
    // Sin permiso de corrección no se ofrece corregir pagos.
    expect(
      screen.queryByRole('button', { name: 'Corregir pago' }),
    ).not.toBeInTheDocument()
  })

  it('el Administrador puede corregir un pago vigente', async () => {
    mocks.permissions = ['pagos_artesanales.anular']
    mocks.operation.data = operation()
    renderAt(
      '/maintenance/service-operations/4',
      '/maintenance/service-operations/:id',
      <ServiceOperationDetailPage />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Corregir pago' }))
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'no representa un reembolso',
    )
  })

  it('una operación anulada explica que sus servicios quedaron pendientes', () => {
    mocks.operation.data = operation({
      state: 'VOIDED',
      void_reason: 'Precio equivocado',
      allowed_actions: [],
    })
    renderAt(
      '/maintenance/service-operations/4',
      '/maintenance/service-operations/:id',
      <ServiceOperationDetailPage />,
    )
    expect(screen.getByText(/Motivo: Precio equivocado/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Cobrar/ }),
    ).not.toBeInTheDocument()
  })
})

describe('ServiceOperationDocumentPage', () => {
  const ARTISAN_LOGO =
    '/api/v1/workshop-configuration/entity-logos/ARTESANAL/4/'

  function renderDocument() {
    mocks.operation.data = operation()
    renderAt(
      '/maintenance/service-operations/4/document',
      '/maintenance/service-operations/:id/document',
      <ServiceOperationDocumentPage />,
    )
  }

  beforeEach(() => {
    mocks.scopes = []
    mocks.brands = {
      COMERCIAL: {
        logoUrl: '/api/v1/workshop-configuration/entity-logos/COMERCIAL/1/',
        legalName: 'Repuestos',
      },
      ARTESANAL: { logoUrl: null, legalName: 'Taller vigente' },
    }
  })

  it('encabeza con el logotipo artesanal y el nombre conservado, nunca con el comercial', () => {
    mocks.brands.ARTESANAL = {
      logoUrl: ARTISAN_LOGO,
      legalName: 'Taller vigente',
    }
    renderDocument()
    const issuer = screen.getByRole('group', { name: 'Emisor' })
    expect(issuer).toHaveTextContent('Taller Artesanal')
    expect(
      within(issuer).getByRole('img', { name: 'Logo de Taller Artesanal' }),
    ).toHaveAttribute('src', ARTISAN_LOGO)
    expect(mocks.scopes.every((scope) => scope === 'ARTESANAL')).toBe(true)
  })

  it('sin logotipo artesanal muestra solo el nombre del emisor', () => {
    renderDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Emisor' })).toHaveTextContent(
      'Taller Artesanal',
    )
    expect(
      screen.getByRole('button', { name: 'Imprimir comprobante' }),
    ).toBeEnabled()
  })

  it('una operación anulada muestra el logotipo vigente y conserva sus datos históricos', () => {
    mocks.brands.ARTESANAL = {
      logoUrl: ARTISAN_LOGO,
      legalName: 'Taller vigente',
    }
    mocks.operation.data = operation({
      state: 'VOIDED',
      void_reason: 'Precio equivocado',
    })
    renderAt(
      '/maintenance/service-operations/4/document',
      '/maintenance/service-operations/:id/document',
      <ServiceOperationDocumentPage />,
    )
    const issuer = screen.getByRole('group', { name: 'Emisor' })
    expect(
      within(issuer).getByRole('img', { name: 'Logo de Taller Artesanal' }),
    ).toHaveAttribute('src', ARTISAN_LOGO)
    expect(issuer).toHaveTextContent('Taller Artesanal')
    expect(
      screen.getByText(/Taller Artesanal · 1790000000002/),
    ).toBeInTheDocument()
    expect(screen.getAllByText('ART-SER-000004').length).toBeGreaterThan(0)
  })

  it('espera el logotipo antes de permitir imprimir', () => {
    mocks.brands.ARTESANAL = {
      logoUrl: ARTISAN_LOGO,
      legalName: 'Taller vigente',
    }
    renderDocument()
    const button = screen.getByRole('button', { name: 'Imprimir comprobante' })
    expect(button).toBeDisabled()
    fireEvent.error(
      screen.getByRole('img', { name: 'Logo de Taller Artesanal' }),
    )
    expect(button).toBeEnabled()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('identifica el RUC artesanal y declara que no es factura del SRI', () => {
    mocks.operation.data = operation()
    renderAt(
      '/maintenance/service-operations/4/document',
      '/maintenance/service-operations/:id/document',
      <ServiceOperationDocumentPage />,
    )
    expect(
      screen.getByText(/Taller Artesanal · 1790000000002/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/no constituye factura electrónica/),
    ).toBeInTheDocument()
  })
})

describe('ArtisanReceivablesPage', () => {
  it('muestra totales de todas las coincidencias y antigüedad sin mora', () => {
    mocks.receivables.data = {
      count: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
      totals: { grand_total: '60.00', paid: '20.00', balance: '40.00' },
      results: [
        {
          id: 4,
          internal_number: 'ART-SER-000004',
          fiscal_entity: 'ARTESANAL',
          document_type: 'SERVICIO',
          order_id: 9,
          order_number: 'ART-OT-000009',
          customer_id: 3,
          customer_name: 'Ana Pérez',
          condition: 'CREDITO',
          operational_date: '2026-09-14',
          age_days: 10,
          grand_total: '60.00',
          paid: '20.00',
          balance: '40.00',
          payment_state: 'PARTIAL',
        },
      ],
    }
    renderAt(
      '/maintenance/receivables',
      '/maintenance/receivables',
      <ArtisanReceivablesPage />,
    )
    expect(
      screen.getByLabelText('Totales de todas las coincidencias'),
    ).toHaveTextContent('Saldo por cobrar')
    expect(screen.getAllByText('10 días').length).toBeGreaterThan(0)
    expect(screen.queryByText(/mora|vencid/i)).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: 'ART-SER-000004' })[0],
    ).toHaveAttribute('href', '/maintenance/service-operations/4')
  })
})

describe('CommercialOrderViewPage', () => {
  it('muestra la orden de origen sin servicios, diagnóstico ni fotografías', () => {
    mocks.commercial.data = {
      id: 9,
      number: 'ART-OT-000009',
      state: 'REGISTERED',
      opened_on: '2026-09-20',
      customer: { name: 'Ana Pérez', identification: '1712345678' },
      vehicle: { plate: 'ABC-1234', brand: 'Toyota', model: 'Hilux' },
      parts: [
        {
          id: 31,
          state: 'DRAFT',
          internal_number: null,
          lines: [
            {
              id: 1,
              position: 1,
              product_id: 7,
              product_code: 'FO-100',
              product_name: 'Filtro',
              quantity: '2',
            },
          ],
        },
      ],
    }
    renderAt(
      '/maintenance/9/commercial',
      '/maintenance/:id/commercial',
      <CommercialOrderViewPage />,
    )
    expect(
      screen.getByRole('heading', { name: 'ART-OT-000009' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Reservado, pendiente de confirmar'),
    ).toBeInTheDocument()
    expect(screen.getByText(/FO-100 · Filtro/)).toBeInTheDocument()
    expect(
      screen.queryByText(/Diagnóstico|Servicios|Fotografías/),
    ).not.toBeInTheDocument()
  })
})
