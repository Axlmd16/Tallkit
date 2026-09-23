import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  purchase: {} as Record<string, unknown>,
  voidPreview: vi.fn(),
  voidPurchase: vi.fn(),
  replacement: vi.fn(),
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
    replacement: { mutateAsync: mocks.replacement },
  }),
}))

import { ToastProvider } from '@/shared/ui'

import { PurchaseDetailPage } from './PurchaseDetailPage'

const confirmed = {
  id: 4,
  state: 'CONFIRMED',
  version: 2,
  internal_number: 'COM-ING-000004',
  supplier: {
    id: 1,
    name: 'Repuestos SA',
    identification_type: null,
    identification: null,
  },
  document: {
    type: 'FACTURA',
    reference: 'F-9',
    normalized_reference: 'F-9',
    no_document_reason: '',
  },
  document_date: '2026-01-10',
  notes: '',
  replaces_id: 2,
  replacements: [{ id: 8, state: 'DRAFT', internal_number: null }],
  confirmed_at: '2026-01-20T15:00:00Z',
  voided_at: null,
  void_reason: '',
  inventory_operation_id: 31,
  void_operation_id: null,
  totals: {
    base: '20.00',
    tax: '2.00',
    total: '22.00',
    inventory_value: '20.00',
  },
  totals_status: 'calculated',
  lines: [
    {
      id: 1,
      position: 1,
      product: {
        id: 5,
        code: 'ACE-1',
        name: 'Aceite',
        unit_name: 'Galón',
        unit_symbol: 'gal',
        is_active: null,
      },
      quantity: '2',
      unit_cost: '10.000000',
      tax_recoverability: 'RECOVERABLE',
      tax: {
        definition_id: 9,
        code: 'IVA',
        rate: '10.0000',
        status: 'applicable',
      },
      amounts: {
        base: '20.00',
        tax: '2.00',
        total: '22.00',
        inventory_value: '20.00',
      },
    },
  ],
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/purchases/4']}>
      <ToastProvider>
        <Routes>
          <Route element={<PurchaseDetailPage />} path="/purchases/:id" />
          <Route element={<p>editor abierto</p>} path="/purchases/:id/edit" />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.permissions = [
    'ingresos.ver',
    'ingresos.crear',
    'ingresos.anular',
    'inventario.ver',
  ]
  mocks.purchase = confirmed
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
  mocks.voidPurchase.mockResolvedValue({ ...confirmed, state: 'VOIDED' })
  mocks.replacement.mockResolvedValue({ id: 20 })
})

it('muestra fechas diferenciadas, estado, ámbito, totales, líneas históricas y vínculos', () => {
  renderPage()
  expect(
    screen.getByRole('heading', { name: 'COM-ING-000004' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Confirmado')).toBeInTheDocument()
  expect(screen.queryByText('RUC comercial')).toBeNull()
  expect(screen.getByText('10/01/2026')).toBeInTheDocument()
  expect(screen.getByText('Fecha de confirmación')).toBeInTheDocument()
  expect(screen.getByLabelText('Línea 1')).toHaveTextContent('ACE-1 — Aceite')
  expect(screen.getByLabelText('Totales')).toHaveTextContent('USD 22.00')
  expect(screen.getByRole('link', { name: '#2' })).toHaveAttribute(
    'href',
    '/purchases/2',
  )
  expect(screen.getByRole('link', { name: 'Borrador #8' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'INV-31' }).className).toMatch(
    /\btext-accent\b/,
  )
  expect(screen.getByRole('link', { name: 'INV-31' })).toHaveAttribute(
    'href',
    '/inventory/operations/31',
  )
})

it('sin permiso de inventario no muestra enlaces a operaciones', () => {
  mocks.permissions = ['ingresos.ver']
  renderPage()
  expect(screen.queryByRole('link', { name: 'INV-31' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Anular ingreso' })).toBeNull()
})

it('anular exige motivo, explica el efecto y envía token, versión y motivo', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Anular ingreso' }))
  const dialog = await screen.findByRole('dialog')
  expect(
    await within(dialog).findByLabelText('Efecto de la anulación'),
  ).toHaveTextContent('ACE-1')
  const confirm = within(dialog).getByRole('button', { name: 'Anular ingreso' })
  expect(
    within(dialog).getByRole('button', { name: 'Conservar ingreso' }),
  ).toBeInTheDocument()
  expect(dialog).toHaveTextContent('RUC comercial')
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
      'Ingreso COM-ING-000004 anulado y su efecto compensado.',
    ),
  ).toBeInTheDocument()
})

it('una anulación insegura nombra el producto y la referencia que la bloquean', async () => {
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
  await userEvent.click(screen.getByRole('button', { name: 'Anular ingreso' }))
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
    within(dialog).getByRole('button', { name: 'Anular ingreso' }),
  ).toBeDisabled()
})

it('el reemplazo crea el borrador vinculado y abre su editor', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Crear reemplazo' }))
  await userEvent.click(
    await screen.findByRole('button', { name: 'Crear borrador de reemplazo' }),
  )
  await waitFor(() => expect(mocks.replacement).toHaveBeenCalledTimes(1))
  expect(await screen.findByText('editor abierto')).toBeInTheDocument()
})
