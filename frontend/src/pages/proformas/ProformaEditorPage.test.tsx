import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import draftSource from '@/features/proformas/draft.ts?raw'
import linesSource from '@/features/proformas/ProformaLinesEditor.tsx?raw'
import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

import editorSource from './ProformaEditorPage.tsx?raw'

const mocks = vi.hoisted(() => ({
  proforma: undefined as unknown,
  draftPreview: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  refetch: vi.fn(),
}))

vi.mock('@/features/proformas/api', () => ({
  proformasApi: {
    draftPreview: (...args: unknown[]) => mocks.draftPreview(...args),
  },
}))
vi.mock('@/features/proformas/hooks', () => ({
  useProforma: () => ({
    data: mocks.proforma,
    isPending: false,
    isError: false,
    refetch: mocks.refetch,
  }),
  useProformaMutations: () => ({
    create: { mutateAsync: mocks.create },
    update: { mutateAsync: mocks.update },
  }),
}))
vi.mock('@/features/proformas/pickers', () => ({
  useCustomerPickerOptions: () => ({
    isPending: false,
    isError: false,
    data: {
      totalPages: 1,
      options: [{ id: 1, label: 'Ana Pérez', detail: 'CI 1712345678' }],
    },
  }),
  useProductPickerOptions: () => ({
    isPending: false,
    isError: false,
    data: {
      totalPages: 1,
      options: [
        { id: 5, label: 'FIL-1 — Filtro', detail: 'Precio final USD 11.50' },
      ],
    },
  }),
}))
vi.mock('@/features/proformas/IssueDialog', () => ({
  IssueDialog: ({ open }: { open: boolean }) =>
    open ? <p role="dialog">Revisión de emisión</p> : null,
}))

import { ProformaEditorPage } from './ProformaEditorPage'

const line = (overrides: Record<string, unknown> = {}) => ({
  position: 1,
  product_id: 5,
  product_code: 'FIL-1',
  product_name: 'Filtro',
  product_active: true,
  is_kit: false,
  quantity: '2',
  unit_price: '11.50',
  tax_rate: '15',
  base_amount: '20.00',
  tax_amount: '3.00',
  total_amount: '23.00',
  availability: '5',
  availability_sufficient: true,
  ...overrides,
})

const preview = (overrides: Record<string, unknown> = {}) => ({
  status: 'DRAFT_PREVIEW',
  internal_number: null,
  customer: { id: 1, name: 'Ana Pérez' },
  issues: [],
  can_issue: false,
  issue_date: '2026-10-06',
  valid_until: '2026-10-13',
  suggested_valid_until: '2026-10-13',
  lines: [line()],
  totals: { base: '20.00', tax: '3.00', total: '23.00' },
  warnings: [],
  ...overrides,
})

const saved = (overrides: Record<string, unknown> = {}) => ({
  id: 9,
  state: 'DRAFT',
  version: 3,
  internal_number: null,
  customer: { id: 1, name: 'Ana Pérez' },
  valid_until: null,
  origin: null,
  allowed_actions: ['edit', 'issue', 'void'],
  lines: [line()],
  ...overrides,
})

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderEditor(path = '/proformas/9/edit') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<ProformaEditorPage />} path="/proformas/new" />
          <Route
            element={
              <>
                <ProformaEditorPage />
                <Where />
              </>
            }
            path="/proformas/:id/edit"
          />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.proforma = saved()
  mocks.draftPreview.mockResolvedValue(preview())
  mocks.refetch.mockResolvedValue(undefined)
})

it('muestra precio y total del servidor sin campos para editarlos', async () => {
  renderEditor()
  const table = await screen.findByRole('table')
  expect(await within(table).findByText('USD 11.50')).toBeInTheDocument()
  expect(within(table).getByText('USD 23.00')).toBeInTheDocument()
  expect(mocks.draftPreview).toHaveBeenLastCalledWith({
    customer_id: 1,
    valid_until: null,
    lines: [{ product_id: 5, quantity: '2' }],
  })
  const inputs = screen
    .getAllByRole('textbox')
    .map((input) => input.getAttribute('aria-label') ?? input.id)
  expect(inputs.join(' ')).not.toMatch(/precio|total|impuesto|descuento/i)
  expect(screen.getByLabelText('Cantidad de la línea 1')).toHaveValue('2')
})

it('el frontend no calcula importes ni envía campos económicos', () => {
  for (const source of [editorSource, linesSource, draftSource]) {
    expect(source).not.toMatch(/parseFloat|Number\([^)]*(price|total|amount)/)
    expect(source).not.toMatch(/\*\s*(Number|quantity|price)/)
    expect(source).not.toMatch(/unit_price\s*:|discount|tax_rate\s*:/)
  }
})

it('permite cotizar sin disponibilidad suficiente y lo avisa sin bloquear', async () => {
  mocks.draftPreview.mockResolvedValue(
    preview({
      lines: [line({ availability: '1', availability_sufficient: false })],
    }),
  )
  renderEditor()
  expect(
    await screen.findByLabelText('Disponibilidad insuficiente'),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Revisar y emitir' })).toBeEnabled()
})

it('guarda cliente, vigencia, productos y cantidades y lo confirma junto a las acciones', async () => {
  const user = userEvent.setup()
  mocks.update.mockResolvedValue(saved({ version: 4 }))
  renderEditor()
  const quantity = await screen.findByLabelText('Cantidad de la línea 1')
  await user.clear(quantity)
  await user.type(quantity, '4')
  expect(screen.getByText('Cambios sin guardar')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Revisar y emitir' }),
  ).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
  const sent = mocks.update.mock.calls[0]![0]
  expect(sent).toMatchObject({
    id: 9,
    expectedVersion: 3,
    data: {
      customer_id: 1,
      valid_until: null,
      lines: [{ product_id: 5, quantity: '4' }],
    },
  })
  expect(Object.keys(sent.data)).toEqual([
    'customer_id',
    'valid_until',
    'lines',
  ])
  expect(
    (await screen.findAllByText('Borrador guardado.')).length,
  ).toBeGreaterThan(0)
  await waitFor(() =>
    expect(screen.queryByText('Cambios sin guardar')).toBeNull(),
  )
})

it('la vigencia admite una fecha elegida o los 7 días predeterminados', async () => {
  const user = userEvent.setup()
  mocks.update.mockResolvedValue(saved())
  renderEditor()
  expect(
    await screen.findByText(/Sin fecha: 7 días, hasta el 13\/10\/2026/),
  ).toBeInTheDocument()
  const field = screen.getByLabelText('Vigente hasta')
  await user.type(field, '2026-10-20')
  expect(screen.getByText(/Fecha elegida/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  await waitFor(() =>
    expect(mocks.update.mock.calls[0]![0].data.valid_until).toBe('2026-10-20'),
  )
})

it('un error al guardar conserva la captura y se muestra junto al campo', async () => {
  const user = userEvent.setup()
  mocks.update.mockRejectedValue(
    new ProblemError('Datos inválidos.', 400, 'validation_error', undefined, {
      'lines.0.quantity': ['La cantidad excede el máximo permitido.'],
    }),
  )
  renderEditor()
  const quantity = await screen.findByLabelText('Cantidad de la línea 1')
  await user.clear(quantity)
  await user.type(quantity, '7')
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  expect(
    await screen.findByText('La cantidad excede el máximo permitido.'),
  ).toBeInTheDocument()
  expect(screen.getByText('No se guardó el borrador')).toBeInTheDocument()
  expect(screen.getByLabelText('Cantidad de la línea 1')).toHaveValue('7')
  expect(screen.getByLabelText('Cantidad de la línea 1')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  expect(screen.getByText('Cambios sin guardar')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeEnabled()
})

it('una respuesta incierta reintenta con la misma clave de intento', async () => {
  const user = userEvent.setup()
  mocks.update
    .mockRejectedValueOnce(new ProblemError('Sin respuesta.', 0, 'network'))
    .mockResolvedValue(saved())
  renderEditor()
  const quantity = await screen.findByLabelText('Cantidad de la línea 1')
  await user.clear(quantity)
  await user.type(quantity, '3')
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  expect(
    await screen.findByText('No sabemos si el borrador se guardó'),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Reintentar guardado' }))
  await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2))
  expect(mocks.update.mock.calls[1]![0].key).toBe(
    mocks.update.mock.calls[0]![0].key,
  )
})

it('un guardado obsoleto no sobrescribe y ofrece recargar', async () => {
  const user = userEvent.setup()
  mocks.update.mockRejectedValue(
    new ProblemError('La proforma cambió.', 409, 'stale_record'),
  )
  renderEditor()
  const quantity = await screen.findByLabelText('Cantidad de la línea 1')
  await user.clear(quantity)
  await user.type(quantity, '6')
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  expect(
    await screen.findByText('La proforma cambió desde que la abrió'),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Cantidad de la línea 1')).toHaveValue('6')
  await user.click(
    screen.getByRole('button', { name: 'Recargar la versión guardada' }),
  )
  expect(mocks.refetch).toHaveBeenCalled()
})

it('advierte al salir con cambios sin guardar', async () => {
  const user = userEvent.setup()
  const add = vi.spyOn(window, 'addEventListener')
  renderEditor()
  const quantity = await screen.findByLabelText('Cantidad de la línea 1')
  expect(add.mock.calls.some(([name]) => name === 'beforeunload')).toBe(false)
  await user.type(quantity, '5')
  expect(add.mock.calls.some(([name]) => name === 'beforeunload')).toBe(true)
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  add.mockRestore()
})

it('una cantidad fraccionaria se señala y no se puede guardar', async () => {
  const user = userEvent.setup()
  renderEditor()
  const quantity = await screen.findByLabelText('Cantidad de la línea 1')
  await user.clear(quantity)
  await user.type(quantity, '1.5')
  expect(
    screen.getByText('La cantidad debe ser un entero positivo.'),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Guardar borrador' }),
  ).toBeDisabled()
})

it('revisar y emitir exige el borrador guardado', async () => {
  const user = userEvent.setup()
  renderEditor()
  const review = await screen.findByRole('button', { name: 'Revisar y emitir' })
  expect(review).toBeEnabled()
  await user.click(review)
  expect(screen.getByRole('dialog')).toHaveTextContent('Revisión de emisión')
})

it('una proforma nueva pide cliente antes de guardar', async () => {
  mocks.proforma = undefined
  renderEditor('/proformas/new')
  expect(
    await screen.findByText('Seleccione un cliente para guardar.'),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Guardar borrador' }),
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Revisar y emitir' }),
  ).toBeDisabled()
  expect(screen.queryByText('Cambios sin guardar')).toBeNull()
})

it('una proforma emitida no se edita y remite a su ficha', () => {
  mocks.proforma = saved({
    state: 'VALID',
    internal_number: 'COM-PRO-000001',
    allowed_actions: ['convert', 'void', 'copy', 'print'],
  })
  renderEditor()
  expect(screen.getByText('Esta proforma ya no se edita')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardar borrador' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute(
    'href',
    '/proformas/9',
  )
})

it('una copia muestra el enlace a su proforma de origen', async () => {
  mocks.proforma = saved({
    origin: { id: 4, number: 'COM-PRO-000001', state: 'EXPIRED' },
  })
  renderEditor()
  expect(
    await screen.findByRole('link', { name: 'COM-PRO-000001' }),
  ).toHaveAttribute('href', '/proformas/4')
})

it('los pendientes para emitir se informan sin impedir guardar', async () => {
  mocks.draftPreview.mockResolvedValue(
    preview({
      issues: [
        {
          code: 'inactive_reference',
          field: 'lines.0.product_id',
          message: 'El producto está inactivo.',
        },
      ],
    }),
  )
  renderEditor()
  expect(
    await screen.findByText('Línea 1: El producto está inactivo.'),
  ).toBeInTheDocument()
  expect(screen.getByText('Pendiente para emitir')).toBeInTheDocument()
})
