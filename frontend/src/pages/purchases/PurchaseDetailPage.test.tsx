import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  purchase: {} as Record<string, unknown>,
  voidPreview: vi.fn(),
  voidPurchase: vi.fn(),
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/purchases/hooks', () => ({
  usePurchase: () => ({
    data: mocks.purchase,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  usePurchaseMutations: () => ({
    voidPreview: { mutateAsync: mocks.voidPreview },
    void: { mutateAsync: mocks.voidPurchase },
  }),
}))

import { ToastProvider } from '@/shared/ui'

import { PurchaseDetailPage } from './PurchaseDetailPage'

const line = (extra: Record<string, unknown> = {}) => ({
  id: 1,
  position: 1,
  product: {
    id: 5,
    code: 'ACE-1',
    name: 'Aceite',
    unit_name: 'Galón',
    unit_symbol: 'gal',
  },
  quantity: '2',
  ...extra,
})

const entry = {
  id: 4,
  flow: 'SIMPLE',
  state: 'CONFIRMED',
  version: 2,
  internal_number: 'COM-ING-000004',
  supplier: { id: 1, name: 'Repuestos SA' },
  reference: 'F-9',
  observation: 'Llegó por la tarde',
  registered_by: { id: 3, name: 'Laura Vendedora' },
  created_at: '2026-10-04T15:00:00Z',
  confirmed_at: '2026-10-04T15:00:00Z',
  voided_at: null,
  void_reason: '',
  voided_by: null,
  inventory_operation_id: 31,
  void_operation_id: null,
  lines: [line()],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/purchases/4']}>
      <ToastProvider>
        <Routes>
          <Route element={<PurchaseDetailPage />} path="/purchases/:id" />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

const admin = [
  'ingresos.ver',
  'ingresos.anular',
  'inventario.ver',
  'productos.ver_costos',
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions = ['ingresos.ver', 'inventario.ver']
  mocks.purchase = entry
  mocks.voidPreview.mockResolvedValue({
    purchase_id: 4,
    state: 'CONFIRMED',
    version: 2,
    can_void: true,
    issues: [],
    effects: [
      {
        product_id: 5,
        code: 'ACE-1',
        quantity_to_remove: '2',
        quantity_to_restore: '0',
        current_quantity: '7',
      },
    ],
    review_token: 'void-token',
    expires_in_seconds: 900,
  })
  mocks.voidPurchase.mockResolvedValue({ ...entry, state: 'VOIDED' })
})

it('el Vendedor ve quién registró, qué entró y el vínculo al movimiento, sin costos ni anulación', () => {
  renderPage()
  expect(
    screen.getByRole('heading', { name: 'COM-ING-000004' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Registrada')).toBeInTheDocument()
  expect(screen.getByText('Laura Vendedora')).toBeInTheDocument()
  expect(screen.getByText('Repuestos SA')).toBeInTheDocument()
  expect(screen.getByText('F-9')).toBeInTheDocument()
  expect(screen.getByText('Llegó por la tarde')).toBeInTheDocument()
  expect(screen.getByLabelText('Línea 1')).toHaveTextContent('ACE-1 — Aceite')
  expect(screen.getByText('1 producto · 2 unidades')).toBeInTheDocument()
  expect(screen.queryByText(/costo|USD/i)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Anular entrada' })).toBeNull()
  expect(screen.getByRole('link', { name: 'INV-31' })).toHaveAttribute(
    'href',
    '/inventory/operations/31',
  )
})

it('los datos opcionales ausentes no ocupan espacio', () => {
  mocks.purchase = { ...entry, supplier: null, reference: '', observation: '' }
  renderPage()
  expect(screen.queryByText('Proveedor')).toBeNull()
  expect(screen.queryByText('Referencia')).toBeNull()
  expect(screen.queryByText('Observación')).toBeNull()
})

it('sin permiso de inventario no muestra enlaces a movimientos', () => {
  mocks.permissions = ['ingresos.ver']
  renderPage()
  expect(screen.queryByRole('link', { name: 'INV-31' })).toBeNull()
})

it('el Administrador distingue una línea sin costo de una con costo, incluido el cero', () => {
  mocks.permissions = admin
  mocks.purchase = {
    ...entry,
    lines: [
      line({ cost_registered: true, unit_cost: '4.500000' }),
      line({ id: 2, position: 2, cost_registered: false, unit_cost: null }),
      line({
        id: 3,
        position: 3,
        cost_registered: true,
        unit_cost: '0.000000',
      }),
    ],
  }
  renderPage()
  expect(screen.getByLabelText('Línea 1')).toHaveTextContent('4.50')
  expect(screen.getByLabelText('Línea 2')).toHaveTextContent('Sin costo')
  expect(screen.getByLabelText('Línea 3')).not.toHaveTextContent('Sin costo')
  expect(screen.getByLabelText('Línea 3')).toHaveTextContent('0.00')
})

it('una entrada anulada muestra quién, cuándo y por qué, y no ofrece anular de nuevo', () => {
  mocks.permissions = admin
  mocks.purchase = {
    ...entry,
    state: 'VOIDED',
    voided_at: '2026-10-05T10:00:00Z',
    voided_by: { id: 1, name: 'Admin' },
    void_reason: 'Error de captura',
    void_operation_id: 33,
  }
  renderPage()
  expect(screen.getByText('Entrada anulada')).toBeInTheDocument()
  expect(screen.getByText(/por Admin/)).toBeInTheDocument()
  expect(screen.getByText(/Error de captura/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Anular entrada' })).toBeNull()
  expect(screen.getByRole('link', { name: 'INV-33' })).toBeInTheDocument()
})

it('anular exige motivo, explica el efecto y envía token, versión y motivo', async () => {
  mocks.permissions = admin
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Anular entrada' }))
  const dialog = await screen.findByRole('dialog')
  expect(
    await within(dialog).findByLabelText('Efecto de la anulación'),
  ).toHaveTextContent('ACE-1')
  const confirm = within(dialog).getByRole('button', { name: 'Anular entrada' })
  expect(
    within(dialog).getByRole('button', { name: 'Conservar entrada' }),
  ).toBeInTheDocument()
  expect(confirm).toBeDisabled()
  await userEvent.type(
    within(dialog).getByLabelText('Motivo de la anulación'),
    'Error de captura',
  )
  await waitFor(() => expect(confirm).toBeEnabled())
  await userEvent.click(confirm)
  await waitFor(() => expect(mocks.voidPurchase).toHaveBeenCalledTimes(1))
  expect(mocks.voidPurchase.mock.calls[0]![0]).toMatchObject({
    id: 4,
    expectedVersion: 2,
    reviewToken: 'void-token',
    reason: 'Error de captura',
  })
  expect(
    await screen.findByText(
      'Entrada COM-ING-000004 anulada y su efecto compensado.',
    ),
  ).toBeInTheDocument()
})

it('una anulación insegura nombra el producto y la referencia que la bloquean', async () => {
  mocks.permissions = admin
  mocks.voidPreview.mockResolvedValue({
    purchase_id: 4,
    state: 'CONFIRMED',
    version: 2,
    can_void: false,
    issues: [
      {
        code: 'unsafe_reversal',
        field: 'lines',
        product_id: 5,
        product_code: 'ACE-1',
        blocking_reference: 'INV-40',
        message:
          'El producto tiene movimientos posteriores; no se puede anular el ingreso.',
      },
    ],
    effects: [],
    review_token: null,
    expires_in_seconds: 900,
  })
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Anular entrada' }))
  const dialog = await screen.findByRole('dialog')
  expect(
    await within(dialog).findByText(/movimientos posteriores/),
  ).toBeInTheDocument()
  expect(within(dialog).getByRole('link', { name: 'INV-40' })).toHaveAttribute(
    'href',
    '/inventory/operations/40',
  )
  await userEvent.type(
    within(dialog).getByLabelText('Motivo de la anulación'),
    'x',
  )
  expect(
    within(dialog).getByRole('button', { name: 'Anular entrada' }),
  ).toBeDisabled()
})

it('una compra anterior separa sus datos documentales en otra pestaña, solo para el Administrador', async () => {
  mocks.permissions = admin
  mocks.purchase = {
    ...entry,
    flow: 'LEGACY',
    reference: 'F-9',
    lines: [
      line({
        cost_registered: true,
        unit_cost: '10.000000',
        tax: { definition_id: 9, code: 'IVA', rate: '10' },
        amounts: {
          base: '20.00',
          tax: '2.00',
          total: '22.00',
          inventory_value: '20.00',
        },
      }),
    ],
    legacy: {
      document: { type: 'FACTURA', reference: 'F-9', no_document_reason: '' },
      document_date: '2026-01-10',
      replaces_id: null,
      replacements: [],
      totals: {
        base: '20.00',
        tax: '2.00',
        total: '22.00',
        inventory_value: '20.00',
      },
      is_pending_draft: false,
    },
  }
  renderPage()
  expect(screen.queryByLabelText('Totales de la compra anterior')).toBeNull()
  await userEvent.click(screen.getByRole('tab', { name: 'Compra anterior' }))
  expect(
    screen.getByLabelText('Totales de la compra anterior'),
  ).toHaveTextContent('22.00')
  expect(screen.getByText('2026-01-10')).toBeInTheDocument()
})

it('un borrador anterior se explica como sin efecto', async () => {
  mocks.permissions = admin
  mocks.purchase = {
    ...entry,
    flow: 'LEGACY',
    state: 'DRAFT',
    internal_number: null,
    confirmed_at: null,
    legacy: {
      document: { type: 'FACTURA', reference: 'F-1', no_document_reason: '' },
      document_date: '2026-01-10',
      replaces_id: null,
      replacements: [],
      totals: null,
      is_pending_draft: true,
    },
  }
  renderPage()
  await userEvent.click(screen.getByRole('tab', { name: 'Compra anterior' }))
  expect(screen.getByText('Borrador sin efecto')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Anular entrada' })).toBeNull()
})
