import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  copy: vi.fn(),
  void: vi.fn(),
}))

vi.mock('@/features/proformas/hooks', () => ({
  useProforma: () => mocks.query,
  useProformaMutations: () => ({
    copy: { mutateAsync: mocks.copy },
    void: { mutateAsync: mocks.void },
  }),
}))
vi.mock('@/features/proformas/IssueDialog', () => ({
  IssueDialog: ({ open }: { open: boolean }) =>
    open ? <p role="dialog">Diálogo de emisión</p> : null,
}))
vi.mock('@/features/proformas/ConvertDialog', () => ({
  ConvertDialog: ({
    open,
    onConverted,
  }: {
    open: boolean
    onConverted: (p: unknown) => void
  }) =>
    open ? (
      <button
        onClick={() => onConverted({ id: 7, sale: { id: 9, can_open: true } })}
        type="button"
      >
        Simular conversión
      </button>
    ) : null,
}))

import { ProformaDetailPage } from './ProformaDetailPage'

const proforma = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  state: 'VALID',
  version: 2,
  internal_number: 'COM-PRO-000007',
  customer: {
    id: 3,
    name: 'Ana Pérez',
    identification_type: 'CI',
    identification: '1712345678',
  },
  issue_date: '2026-10-06',
  valid_until: '2026-10-13',
  origin: null,
  derived: [],
  sale: null,
  allowed_actions: ['convert', 'void', 'copy', 'print'],
  totals: { base: '20.00', tax: '3.00', total: '23.00' },
  lines: [
    {
      position: 1,
      product_code: 'FIL-1',
      product_name: 'Filtro',
      is_kit: false,
      quantity: '2',
      unit_price: '11.50',
      total_amount: '23.00',
      availability_at_issue: '1',
      availability_sufficient: false,
    },
  ],
  ...overrides,
})

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/proformas/7']}>
        <Routes>
          <Route element={<ProformaDetailPage />} path="/proformas/:id" />
          <Route element={<Where />} path="/proformas/:id/edit" />
          <Route element={<Where />} path="/proformas/:id/document" />
          <Route element={<Where />} path="/sales/:id" />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

const ready = (data: unknown) => ({ isPending: false, isError: false, data })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.query = ready(proforma())
})

it('muestra número, estado con texto, cliente, vigencia, líneas y total', () => {
  renderPage()
  expect(
    screen.getByRole('heading', { name: /COM-PRO-000007/ }),
  ).toHaveTextContent('Vigente')
  expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
  expect(screen.getByText('13/10/2026')).toBeInTheDocument()
  const table = screen.getByRole('table')
  expect(within(table).getByText('FIL-1')).toBeInTheDocument()
  expect(
    within(table).getByLabelText('Disponibilidad insuficiente'),
  ).toBeInTheDocument()
  expect(
    within(table).getByRole('columnheader', { name: 'Disponible al emitir' }),
  ).toBeInTheDocument()
  expect(screen.getAllByText('USD 23.00').length).toBeGreaterThan(0)
})

it.each([
  [
    'DRAFT',
    ['edit', 'issue', 'void'],
    ['Editar', 'Anular', 'Revisar y emitir'],
  ],
  [
    'VALID',
    ['convert', 'void', 'copy', 'print'],
    ['Imprimir', 'Nueva vinculada', 'Anular', 'Convertir en venta'],
  ],
  [
    'EXPIRED',
    ['void', 'copy', 'print'],
    ['Imprimir', 'Nueva vinculada', 'Anular'],
  ],
  ['CONVERTED', ['copy', 'print'], ['Imprimir', 'Nueva vinculada']],
  ['VOIDED', ['copy', 'print'], ['Imprimir', 'Nueva vinculada']],
])(
  'en estado %s ofrece solo las acciones que el servidor permite',
  (state, allowed, labels) => {
    mocks.query = ready(proforma({ state, allowed_actions: allowed }))
    renderPage()
    const all = [
      'Editar',
      'Imprimir',
      'Nueva vinculada',
      'Anular',
      'Revisar y emitir',
      'Convertir en venta',
    ]
    for (const label of all) {
      const button = screen.queryByRole('button', { name: label })
      if (labels.includes(label)) expect(button).toBeInTheDocument()
      else expect(button).toBeNull()
    }
  },
)

it('muestra la proforma anterior, las nuevas y la venta generada en su pestaña', async () => {
  const user = userEvent.setup()
  mocks.query = ready(
    proforma({
      state: 'CONVERTED',
      allowed_actions: ['copy', 'print'],
      origin: { id: 2, number: 'COM-PRO-000002', state: 'EXPIRED' },
      derived: [{ id: 8, number: null, state: 'DRAFT' }],
      sale: {
        id: 9,
        internal_number: 'COM-VEN-000004',
        state: 'CONFIRMED',
        can_open: true,
      },
    }),
  )
  renderPage()
  await user.click(screen.getByRole('tab', { name: /Relacionadas/ }))
  expect(
    screen.getByRole('link', { name: /COM-PRO-000002 · Vencida/ }),
  ).toHaveAttribute('href', '/proformas/2')
  expect(
    screen.getByRole('link', { name: /Borrador · Borrador/ }),
  ).toHaveAttribute('href', '/proformas/8')
  expect(screen.getByRole('link', { name: 'COM-VEN-000004' })).toHaveAttribute(
    'href',
    '/sales/9',
  )
})

it('sin permiso de ventas la venta generada se muestra sin enlace', async () => {
  const user = userEvent.setup()
  mocks.query = ready(
    proforma({
      state: 'CONVERTED',
      allowed_actions: ['print'],
      sale: { id: 9, internal_number: null, state: 'DRAFT', can_open: false },
    }),
  )
  renderPage()
  await user.click(screen.getByRole('tab', { name: /Relacionadas/ }))
  expect(screen.getByText('Venta en borrador')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Venta en borrador' })).toBeNull()
})

it('copiar crea una nueva vinculada y abre su editor sin duplicar por doble clic', async () => {
  const user = userEvent.setup()
  mocks.copy.mockResolvedValue({ id: 12 })
  renderPage()
  await user.dblClick(screen.getByRole('button', { name: 'Nueva vinculada' }))
  await waitFor(() =>
    expect(screen.getByTestId('where')).toHaveTextContent('/proformas/12/edit'),
  )
  expect(mocks.copy).toHaveBeenCalledTimes(1)
})

it('copiar tras una respuesta incierta reutiliza la clave', async () => {
  const user = userEvent.setup()
  mocks.copy
    .mockRejectedValueOnce(new ProblemError('Sin respuesta.', 0, 'net'))
    .mockResolvedValue({ id: 12 })
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Nueva vinculada' }))
  expect(
    await screen.findByText('No sabemos si la acción se aplicó'),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Nueva vinculada' }))
  await waitFor(() => expect(mocks.copy).toHaveBeenCalledTimes(2))
  expect(mocks.copy.mock.calls[1]![0].key).toBe(
    mocks.copy.mock.calls[0]![0].key,
  )
})

it('anular pide confirmación y envía la versión vigente', async () => {
  const user = userEvent.setup()
  mocks.void.mockResolvedValue({ id: 7, state: 'VOIDED' })
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Anular' }))
  const dialog = screen.getByRole('dialog', { name: '¿Anular esta proforma?' })
  expect(dialog).toHaveTextContent('Conserva el número y el contenido')
  expect(mocks.void).not.toHaveBeenCalled()
  await user.click(
    within(dialog).getByRole('button', { name: 'Anular proforma' }),
  )
  await waitFor(() =>
    expect(mocks.void).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, expectedVersion: 2 }),
    ),
  )
  expect(await screen.findByText('Proforma anulada.')).toBeInTheDocument()
})

it('un rechazo al anular se informa y la proforma sigue visible', async () => {
  const user = userEvent.setup()
  mocks.void.mockRejectedValue(
    new ProblemError('La proforma ya fue convertida en venta.', 409, 'x'),
  )
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Anular' }))
  await user.click(screen.getByRole('button', { name: 'Anular proforma' }))
  expect(
    await screen.findByText('La proforma ya fue convertida en venta.'),
  ).toBeInTheDocument()
  expect(screen.getByText('No se completó la acción')).toBeInTheDocument()
})

it('convertir abre la venta creada', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Convertir en venta' }))
  await user.click(screen.getByRole('button', { name: 'Simular conversión' }))
  expect(screen.getByTestId('where')).toHaveTextContent('/sales/9')
})

it('imprimir lleva al documento', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Imprimir' }))
  expect(screen.getByTestId('where')).toHaveTextContent('/proformas/7/document')
})

it('un error de carga no revela datos y ofrece volver', () => {
  mocks.query = { isPending: false, isError: true }
  renderPage()
  expect(screen.getByText('No se pudo cargar la proforma')).toBeInTheDocument()
  expect(screen.queryByText('COM-PRO-000007')).toBeNull()
})
