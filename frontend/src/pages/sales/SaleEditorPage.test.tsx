import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

import draftSource from '@/features/sales/draft.ts?raw'
import linesSource from '@/features/sales/SaleLinesEditor.tsx?raw'
import documentSource from '@/features/sales/SalesDocument.tsx?raw'
// @ts-expect-error Node fs module used in test runner
import fs from 'node:fs'
import { ProblemError } from '@/shared/api/client'
import editorSource from './SaleEditorPage.tsx?raw'

const mocks = vi.hoisted(() => ({
  sale: undefined as unknown,
  draftPreview: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  previewSale: vi.fn(),
  confirm: vi.fn(),
  refetch: vi.fn(),
}))

vi.mock('@/features/sales/api', () => ({
  salesApi: {
    draftPreview: (...args: unknown[]) => mocks.draftPreview(...args),
  },
}))
vi.mock('@/shared/api/entity-logos', () => ({
  useIssuerBrand: (scope: string) => ({
    logoUrl:
      scope === 'COMERCIAL'
        ? '/api/v1/workshop-configuration/entity-logos/COMERCIAL/1/'
        : '/api/v1/workshop-configuration/entity-logos/ARTESANAL/1/',
    legalName: scope === 'COMERCIAL' ? 'Repuestos Andinos' : 'Taller Andino',
  }),
}))
vi.mock('@/features/sales/hooks', () => ({
  useSale: () => ({
    data: mocks.sale,
    isPending: false,
    isError: false,
    refetch: mocks.refetch,
  }),
  useSaleMutations: () => ({
    create: { mutateAsync: mocks.create },
    update: { mutateAsync: mocks.update },
    preview: { mutateAsync: mocks.previewSale },
    confirm: { mutateAsync: mocks.confirm },
  }),
}))
vi.mock('@/features/sales/pickers', () => ({
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
        { id: 5, label: 'ACE-1 — Aceite', detail: 'Precio final USD 11.50' },
        { id: 6, label: 'OLD-1 — Bujía vieja', inactive: true },
      ],
    },
  }),
}))

import { SaleEditorPage } from './SaleEditorPage'

const preview = (total: string) => ({
  status: 'DRAFT_PREVIEW',
  internal_number: null,
  number_pending: true,
  notice:
    'Documento interno; no constituye una factura electrónica autorizada por el SRI.',
  condition: 'CREDITO',
  customer: {
    id: 1,
    name: 'Ana Pérez',
    identification_type: 'CI',
    identification: '1712345678',
  },
  fiscal_entity: {
    type: 'COMERCIAL',
    ruc: '1790000000001',
    legal_name: 'Comercial SA',
  },
  issues: [],
  can_confirm: false,
  operational_date: '2026-09-21',
  lines: [
    {
      position: 1,
      product_code: 'ACE-1',
      product_name: 'Aceite',
      quantity: '2',
      unit_price: '11.50',
      total_amount: total,
      tax_rate: '15',
      base_amount: '20.00',
      tax_amount: '3.00',
    },
  ],
  totals: { base: '20.00', tax: '3.00', total },
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function renderEditor(path = '/sales/new') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<SaleEditorPage />} path="/sales/new" />
          <Route element={<SaleEditorPage />} path="/sales/:id/edit" />
          <Route element={<p>detalle</p>} path="/sales/:id" />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  combobox: string,
  option: string,
) {
  await user.click(screen.getByRole('combobox', { name: combobox }))
  const list = await screen.findByRole('listbox', {
    name: `Resultados de ${combobox}`,
  })
  await user.click(
    within(list).getByRole('option', { name: new RegExp(option) }),
  )
}

const fillLine = (user: ReturnType<typeof userEvent.setup>) =>
  pick(user, 'Producto de la línea 1', 'ACE-1')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.sale = undefined
  mocks.draftPreview.mockResolvedValue(preview('23.00'))
})

it('compone dos superficies: editor y visor con una sola copia editable', async () => {
  renderEditor()
  const form = screen.getByRole('region', { name: 'Captura de la venta' })
  const sheet = screen.getByRole('region', { name: 'Vista previa' })
  expect(form.parentElement).toBe(sheet.parentElement)
  expect(form.parentElement).toHaveClass('sale-workspace')
  expect(screen.getAllByLabelText(/Notas/)).toHaveLength(1)
  expect(
    screen.getAllByRole('article', { name: 'Recibo de venta' }),
  ).toHaveLength(1)
  expect(sheet).toHaveTextContent('Vista previa')
})

it('la vista previa del borrador encabeza con el logotipo y la razón social vigentes del RUC comercial', () => {
  renderEditor()
  const sheet = screen.getByRole('article', { name: 'Recibo de venta' })
  const issuer = within(sheet).getByRole('group', { name: 'Emisor' })
  expect(issuer).toHaveTextContent('Repuestos Andinos')
  expect(
    within(issuer).getByRole('img', { name: 'Logo de Repuestos Andinos' }),
  ).toHaveAttribute(
    'src',
    '/api/v1/workshop-configuration/entity-logos/COMERCIAL/1/',
  )
  expect(sheet).toHaveTextContent('Generado con Tallkit')
})

it('el CSS divide 44/56 desde 1280 px con altura de ventana, visor sticky y una sola vista debajo', () => {
  const css: string = fs.readFileSync('src/features/sales/sales.css', 'utf-8')
  expect(css).toMatch(
    /@media \(min-width: 1280px\)[^{]*{[\s\S]*?grid-template-columns:\s*minmax\(0, 44fr\) minmax\(0, 56fr\)/,
  )
  expect(css).toMatch(/height:\s*calc\(100dvh - 9\.5rem\)/)
  expect(css).toMatch(/\.sale-viewer\s*{[^}]*position:\s*sticky/)
  expect(css).toMatch(
    /\.sale-workspace\[data-view='edit'\] \.sale-viewer[^{]*{[^}]*display:\s*none/,
  )
  expect(css).toMatch(/\.sale-view-switch\s*{[^}]*display:\s*none/)
  expect(css).toMatch(/prefers-reduced-motion/)
})

it('bajo 1280 px alterna Editar y Vista previa conservando la captura y sin duplicar el formulario', async () => {
  const user = userEvent.setup()
  renderEditor()
  const group = screen.getByRole('group', { name: 'Vista' })
  const edit = within(group).getByRole('button', { name: 'Editar' })
  const view = within(group).getByRole('button', { name: 'Vista previa' })
  expect(edit).toHaveAttribute('aria-pressed', 'true')
  const notes = screen.getByLabelText('Notas')
  await user.type(notes, 'nota')
  await user.click(view)
  expect(view).toHaveAttribute('aria-pressed', 'true')
  expect(
    document.querySelector('.sale-workspace')?.getAttribute('data-view'),
  ).toBe('preview')
  await user.click(edit)
  expect(screen.getByLabelText('Notas')).toHaveValue('nota')
  expect(document.querySelectorAll('#sale-form')).toHaveLength(1)
  expect(
    document.querySelectorAll('input#sale-notes, textarea#sale-notes'),
  ).toHaveLength(1)
})

it('el encabezado compacto reúne título, estado y aviso de cambios sin guardar; el ámbito fiscal lo da el marco', async () => {
  const user = userEvent.setup()
  renderEditor()
  expect(
    screen.getByRole('heading', { level: 1, name: 'Nueva venta' }),
  ).toBeInTheDocument()
  expect(
    screen.getByText('Prepare una venta directa de repuestos'),
  ).toBeInTheDocument()
  expect(screen.queryByText('Negocio: Repuestos')).toBeNull()
  expect(screen.getByText('Borrador')).toBeInTheDocument()
  expect(screen.queryByText('Cambios sin guardar')).toBeNull()
  await user.type(screen.getByLabelText('Notas'), 'x')
  await user.click(screen.getByRole('combobox', { name: 'Cliente' }))
  await user.click(await screen.findByRole('option', { name: /Ana Pérez/ }))
  expect(screen.getByText('Cambios sin guardar')).toBeInTheDocument()
})

it('el visor muestra el estado, el zoom y solo acciones que existen', async () => {
  const user = userEvent.setup()
  renderEditor()
  const viewer = screen.getByRole('region', { name: 'Vista previa' })
  await waitFor(() =>
    expect(
      within(viewer).getByRole('status', { name: 'Estado de los importes' }),
    ).toHaveTextContent('Actualizada'),
  )
  const level = within(viewer).getByLabelText('Nivel de zoom')
  const before = level.textContent
  await user.click(
    within(viewer).getByRole('button', { name: 'Aumentar zoom' }),
  )
  expect(level.textContent).not.toBe(before)
  await user.click(
    within(viewer).getByRole('button', { name: 'Ajustar al ancho' }),
  )
  expect(level).toHaveTextContent('100 %')
  expect(
    within(viewer).queryByRole('button', { name: /imprimir|exportar/i }),
  ).toBeNull()
})

it('la hoja es un comprobante interno y no muestra campos de descuento', () => {
  renderEditor()
  const sheet = screen.getByRole('article', { name: 'Recibo de venta' })
  expect(sheet).toHaveTextContent('COMPROBANTE INTERNO')
  expect(sheet).toHaveTextContent('Pendiente de confirmación')
  expect(screen.queryByLabelText(/descuento/i)).toBeNull()
})

it('muestra las etiquetas de borrador, número pendiente y el aviso permanente del SRI', () => {
  renderEditor()
  expect(screen.getByText('Borrador · Vista previa')).toBeInTheDocument()
  expect(screen.getByText('Pendiente de confirmación')).toBeInTheDocument()
  expect(
    screen.getAllByText(
      /no constituye una factura electrónica autorizada por el SRI/,
    ).length,
  ).toBeGreaterThan(0)
  expect(screen.queryByText(/COM-VEN-/)).toBeNull()
})

it('tras 300 ms sin cambios pide una consulta sin clave ni persistencia, no por cada tecla', async () => {
  const user = userEvent.setup()
  renderEditor()
  await waitFor(() => expect(mocks.draftPreview).toHaveBeenCalledTimes(1))
  mocks.draftPreview.mockClear()
  await fillLine(user)
  const quantity = screen.getByLabelText('Cantidad de la línea 1')
  await user.clear(quantity)
  await user.type(quantity, '25')
  expect(mocks.draftPreview.mock.calls.length).toBeLessThanOrEqual(1)
  await waitFor(() => expect(mocks.draftPreview).toHaveBeenCalled())
  const sent = mocks.draftPreview.mock.calls.at(-1)?.[0]
  expect(sent).not.toHaveProperty('idempotency_key')
  expect(sent.lines).toEqual([{ product_id: 5, quantity: '25' }])
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.update).not.toHaveBeenCalled()
})

it('descarta una respuesta fuera de orden y conserva la de la captura más reciente', async () => {
  const first = deferred<ReturnType<typeof preview>>()
  const second = deferred<ReturnType<typeof preview>>()
  mocks.draftPreview.mockReset()
  mocks.draftPreview
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
  const user = userEvent.setup()
  renderEditor()
  await waitFor(() => expect(mocks.draftPreview).toHaveBeenCalledTimes(1))
  await user.click(screen.getByRole('button', { name: 'Agregar producto' }))
  await waitFor(() => expect(mocks.draftPreview).toHaveBeenCalledTimes(2))
  await act(async () => second.resolve(preview('46.00')))
  await act(async () => first.resolve(preview('23.00')))
  const sheet = screen.getByRole('article', { name: 'Recibo de venta' })
  expect(sheet).not.toHaveTextContent('USD 23.00')
})

it('durante el cálculo anuncia «Actualizando…» y marca los valores como pendientes', async () => {
  const pending = deferred<ReturnType<typeof preview>>()
  mocks.draftPreview.mockReset()
  mocks.draftPreview.mockReturnValue(pending.promise)
  renderEditor()
  const status = await screen.findByRole('status', {
    name: 'Estado de los importes',
  })
  await waitFor(() => expect(status).toHaveTextContent('Actualizando…'))
  expect(screen.getByText('Actualizando importes…')).toBeInTheDocument()
  await waitFor(() =>
    expect(
      screen.getByRole('article', { name: 'Recibo de venta' }),
    ).toHaveAttribute('aria-busy', 'true'),
  )
  await act(async () => pending.resolve(preview('23.00')))
  await waitFor(() => expect(status).toHaveTextContent('Actualizada'))
})

it('ante un fallo o datos incompletos muestra guiones y advertencias, nunca ceros inventados', async () => {
  mocks.draftPreview.mockReset()
  mocks.draftPreview.mockRejectedValue(new Error('caída'))
  renderEditor()
  await screen.findByText(/No se pudieron calcular los importes/)
  const sheet = screen.getByRole('article', { name: 'Recibo de venta' })
  expect(sheet).toHaveTextContent('—')
  expect(sheet).not.toHaveTextContent(/USD 0(\.00)?/)
  expect(
    screen.getByRole('status', { name: 'Estado de los importes' }),
  ).toHaveTextContent('Incompleta')
})

it('los importes son cadenas del servidor y nunca se calculan con coma flotante', async () => {
  mocks.draftPreview.mockResolvedValue({
    ...preview('0.30'),
    totals: { base: '0.30', tax: '0.00', total: '0.30' },
  })
  renderEditor()
  await waitFor(() =>
    expect(
      screen.getByRole('article', { name: 'Recibo de venta' }),
    ).toHaveTextContent('USD 0.30'),
  )
  for (const source of [
    documentSource,
    linesSource,
    draftSource,
    editorSource,
  ]) {
    expect(source).not.toMatch(/parseFloat\(|\.toFixed\(|Math\.round\(/)
  }
})
it('la región de estado anuncia con cortesía y no mueve el foco ni relee la hoja', async () => {
  const user = userEvent.setup()
  renderEditor()
  await waitFor(() => expect(mocks.draftPreview).toHaveBeenCalled())
  const status = screen.getByRole('status', { name: 'Estado de los importes' })
  expect(status).toHaveAttribute('aria-live', 'polite')
  expect(
    screen.getByRole('article', { name: 'Recibo de venta' }),
  ).not.toHaveAttribute('aria-live')
  const notes = screen.getByLabelText('Notas')
  await user.click(notes)
  await user.type(notes, 'hola')
  await waitFor(() => expect(mocks.draftPreview).toHaveBeenCalled())
  expect(document.activeElement).toBe(notes)
})

it('la previsualización de captura no habilita confirmar y pide guardar primero', async () => {
  const user = userEvent.setup()
  renderEditor()
  await pick(user, 'Cliente', 'Ana')
  await waitFor(() => expect(mocks.draftPreview).toHaveBeenCalled())
  expect(
    screen.getByRole('button', { name: 'Revisar y confirmar' }),
  ).toBeDisabled()
  expect(
    screen.getByText(/guarde el borrador y revise la versión guardada/),
  ).toBeInTheDocument()
})

it('guarda el borrador con clave de idempotencia y navega a su edición', async () => {
  mocks.create.mockResolvedValue({ id: 9, version: 1 })
  const user = userEvent.setup()
  renderEditor()
  await pick(user, 'Cliente', 'Ana')
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  await waitFor(() => expect(mocks.create).toHaveBeenCalled())
  const call = mocks.create.mock.calls[0]?.[0]
  expect(call.key).toMatch(/^[0-9a-f-]{36}$/)
  expect(call.data.customer_id).toBe(1)
})

it('cantidades inválidas se señalan en su línea', async () => {
  const user = userEvent.setup()
  renderEditor()
  const quantity = screen.getByLabelText('Cantidad de la línea 1')
  await user.clear(quantity)
  await user.type(quantity, '1.5')
  expect(
    screen.getByText('La cantidad debe ser un entero positivo.'),
  ).toBeInTheDocument()
})

it('stale_record conserva la captura y ofrece recargar sin sobrescribir', async () => {
  mocks.sale = {
    id: 9,
    version: 2,
    state: 'DRAFT',
    condition: 'CREDITO',
    notes: 'original',
    customer: { id: 1, name: 'Ana Pérez' },
    lines: [
      {
        id: 1,
        position: 1,
        product_id: 5,
        product_code: 'ACE-1',
        product_name: 'Aceite',
        quantity: '2',
      },
    ],
  }
  mocks.update.mockRejectedValue(
    new ProblemError('Registro desactualizado', 409, 'stale_record'),
  )
  const user = userEvent.setup()
  renderEditor('/sales/9/edit')
  const notes = await screen.findByLabelText('Notas')
  await user.clear(notes)
  await user.type(notes, 'mis cambios')
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  await screen.findByText('La venta cambió desde que la abrió')
  expect(notes).toHaveValue('mis cambios')
  expect(
    screen.getByRole('button', { name: 'Recargar la versión guardada' }),
  ).toBeInTheDocument()
})

it('la tabla de productos usa filas, muestra guiones y no ofrece precio ni descuento editables', async () => {
  renderEditor()
  const table = screen.getByRole('table', { name: /Productos de la venta/ })
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent),
  ).toEqual([
    'Producto',
    'Cantidad',
    'Precio final',
    'Impuesto',
    'Total',
    'Acción',
  ])
  expect(screen.queryByRole('group', { name: /Línea 1/ })).toBeNull()
  expect(screen.queryByLabelText(/precio|impuesto|descuento/i)).toBeNull()
  const row = within(table).getAllByRole('row')[1]!
  expect(within(row).getAllByText('—').length).toBe(3)
})

it('agrega, enfoca y quita productos conservando el resto de la captura', async () => {
  const user = userEvent.setup()
  renderEditor()
  await user.click(screen.getByRole('button', { name: 'Agregar producto' }))
  const second = screen.getByRole('combobox', {
    name: 'Producto de la línea 2',
  })
  expect(second).toHaveFocus()
  await user.click(screen.getByRole('button', { name: /Quitar línea 2/ }))
  expect(
    screen.queryByRole('combobox', { name: 'Producto de la línea 2' }),
  ).toBeNull()
  await user.click(screen.getByRole('button', { name: /Quitar línea 1/ }))
  expect(
    screen.getByText(
      'No hay productos agregados. Añada al menos uno para confirmar la venta.',
    ),
  ).toBeInTheDocument()
})

it('los productos inactivos no son seleccionables y el cliente puede quitarse', async () => {
  const user = userEvent.setup()
  renderEditor()
  await user.click(
    screen.getByRole('combobox', { name: 'Producto de la línea 1' }),
  )
  const inactive = await screen.findByRole('option', { name: /OLD-1/ })
  expect(inactive).toHaveAttribute('aria-disabled', 'true')
  await user.click(inactive)
  expect(
    screen.getByRole('combobox', { name: 'Producto de la línea 1' }),
  ).toHaveValue('')
  await pick(user, 'Cliente', 'Ana')
  expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveValue(
    'Ana Pérez',
  )
  await user.click(
    screen.getByRole('button', { name: /Quitar selección: Ana/ }),
  )
  expect(screen.getByRole('combobox', { name: 'Cliente' })).toHaveValue('')
})

it('el combobox se maneja con teclado: flechas, Enter y Escape', async () => {
  const user = userEvent.setup()
  renderEditor()
  const product = screen.getByRole('combobox', {
    name: 'Producto de la línea 1',
  })
  await user.click(product)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('listbox')).toBeNull()
  await user.keyboard('{ArrowDown}{Enter}')
  expect(product).toHaveValue('ACE-1 — Aceite')
})

it('la condición es una selección exclusiva y el total del servidor acompaña a las acciones', async () => {
  const user = userEvent.setup()
  renderEditor()
  const condition = screen.getByRole('radiogroup', {
    name: 'Condición de venta',
  })
  await user.click(within(condition).getByRole('radio', { name: 'Contado' }))
  expect(
    within(condition).getByRole('radio', { name: 'Contado' }),
  ).toHaveAttribute('aria-checked', 'true')
  await fillLine(user)
  await waitFor(() =>
    expect(document.querySelector('.sale-actions-total')).toHaveTextContent(
      'USD 23.00',
    ),
  )
})

it('una venta vinculada solo edita condición y notas; los repuestos vienen de la orden', async () => {
  mocks.sale = {
    id: 31,
    version: 2,
    state: 'DRAFT',
    condition: 'CONTADO',
    notes: '',
    origin: { type: 'MAINTENANCE', order_id: 9, order_number: 'ART-OT-000009' },
    customer: { id: 1, name: 'Ana Pérez' },
    lines: [
      {
        id: 1,
        position: 1,
        product_id: 5,
        product_code: 'ACE-1',
        product_name: 'Aceite',
        quantity: '2',
      },
    ],
  }
  mocks.update.mockResolvedValue({ ...(mocks.sale as object), version: 3 })
  const user = userEvent.setup()
  renderEditor('/sales/31/edit')
  expect(
    await screen.findByText('Venta vinculada a un mantenimiento'),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('combobox', { name: 'Cliente' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('combobox', { name: 'Producto de la línea 1' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('radio', { name: /Crédito/ }))
  await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 31,
      data: { condition: 'CREDITO', notes: '' },
    }),
  )
})
