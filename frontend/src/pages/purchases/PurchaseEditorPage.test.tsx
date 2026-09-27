import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import type * as ReactRouter from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  /** Simula una navegación que todavía no se aplicó (transición pendiente). */
  holdNavigation: false,
  purchase: undefined as unknown,
  create: vi.fn(),
  update: vi.fn(),
  preview: vi.fn(),
  confirm: vi.fn(),
  refetch: vi.fn(),
}))

vi.mock('@/features/purchases/hooks', () => ({
  usePurchase: () => ({
    data: mocks.purchase,
    isPending: false,
    isError: false,
    refetch: mocks.refetch,
  }),
  usePurchaseTaxOptions: () => ({
    data: {
      results: [
        {
          id: 9,
          code: 'IVA',
          name: 'IVA',
          entity_type: 'COMERCIAL',
          rate: '10',
          tax_status: 'applicable',
        },
      ],
    },
  }),
  usePurchaseMutations: () => ({
    create: { mutateAsync: mocks.create },
    update: { mutateAsync: mocks.update },
    preview: { mutateAsync: mocks.preview },
    confirm: { mutateAsync: mocks.confirm },
  }),
}))
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouter>()
  return {
    ...actual,
    useNavigate: () => {
      const navigate = actual.useNavigate()
      return ((...args: Parameters<typeof navigate>) =>
        mocks.holdNavigation ? undefined : navigate(...args)) as typeof navigate
    },
  }
})
vi.mock('@/shared/api/entity-logos', () => ({
  useIssuerBrand: (scope: string) => ({
    logoUrl:
      scope === 'COMERCIAL'
        ? '/api/v1/workshop-configuration/entity-logos/COMERCIAL/2/'
        : '/api/v1/workshop-configuration/entity-logos/ARTESANAL/2/',
    legalName: scope === 'COMERCIAL' ? 'Repuestos Andinos' : 'Taller Andino',
  }),
}))
vi.mock('@/features/purchases/pickers', () => ({
  useSupplierOptions: () => ({
    isPending: false,
    isError: false,
    data: { totalPages: 1, options: [{ id: 1, label: 'Repuestos SA' }] },
  }),
  useProductOptions: () => ({
    isPending: false,
    isError: false,
    data: {
      totalPages: 1,
      options: [
        { id: 5, label: 'ACE-1 — Aceite', taxDefinitionId: 9 },
        { id: 6, label: 'OLD-1 — Bujía vieja', inactive: true },
      ],
    },
  }),
}))

import { PurchaseEditorPage } from './PurchaseEditorPage'

const draftPurchase = {
  id: 11,
  state: 'DRAFT',
  version: 3,
  internal_number: null,
  supplier: {
    id: 1,
    name: 'Repuestos SA',
    identification_type: null,
    identification: null,
    is_active: true,
  },
  document: {
    type: 'FACTURA',
    reference: 'F-1',
    normalized_reference: 'F-1',
    no_document_reason: '',
  },
  document_date: '2026-01-15',
  notes: '',
  replaces_id: null,
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
        is_active: true,
      },
      quantity: '2',
      unit_cost: '10.000000',
      tax_recoverability: 'RECOVERABLE',
      tax: { definition_id: 9, code: 'IVA', rate: '10', status: 'applicable' },
      amounts: {
        base: '20.00',
        tax: '2.00',
        total: '22.00',
        inventory_value: '20.00',
      },
    },
  ],
}

const review = {
  purchase_id: 11,
  state: 'DRAFT',
  version: 3,
  can_confirm: true,
  issues: [],
  review_token: 'token-1',
  expires_in_seconds: 900,
  totals: {
    base: '20.00',
    tax: '2.00',
    total: '22.00',
    inventory_value: '20.00',
  },
  effects: [
    {
      product_id: 5,
      code: 'ACE-1',
      name: 'Aceite',
      quantity_to_receive: '2',
      current_quantity: '5',
      resulting_quantity: '7',
    },
  ],
  matches: [],
  requires_acknowledgement: false,
}

function renderEditor(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route element={<PurchaseEditorPage />} path="/purchases/new" />
          <Route element={<PurchaseEditorPage />} path="/purchases/:id/edit" />
          <Route element={<p>detalle abierto</p>} path="/purchases/:id" />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.holdNavigation = false
  mocks.purchase = undefined
  mocks.create.mockResolvedValue({ ...draftPurchase, id: 11 })
  mocks.update.mockResolvedValue(draftPurchase)
  mocks.preview.mockResolvedValue(review)
  mocks.confirm.mockResolvedValue({ ...draftPurchase, state: 'CONFIRMED' })
})

it('la vista previa del ingreso encabeza con el logotipo comercial y la razón social vigente', () => {
  renderEditor('/purchases/new')
  const sheet = screen.getByRole('article', { name: 'Comprobante de ingreso' })
  const issuer = within(sheet).getByRole('group', { name: 'Emisor' })
  expect(issuer).toHaveTextContent('Repuestos Andinos')
  expect(
    within(issuer).getByRole('img', { name: 'Logo de Repuestos Andinos' }),
  ).toHaveAttribute(
    'src',
    '/api/v1/workshop-configuration/entity-logos/COMERCIAL/2/',
  )
  expect(sheet).toHaveTextContent('Generado con Tallkit')
})

it('valida en el cliente, asocia cada error a su campo y no envía nada', async () => {
  renderEditor('/purchases/new')
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar borrador' }),
  )
  expect(screen.getByText('Seleccione un proveedor.')).toBeInTheDocument()
  expect(
    screen.getByText('Indique la fecha del documento.'),
  ).toBeInTheDocument()
  expect(
    screen.getByText('La referencia del documento es obligatoria.'),
  ).toBeInTheDocument()
  expect(mocks.create).not.toHaveBeenCalled()
})

it('conserva los decimales como cadenas y prellena el impuesto sugerido del producto', async () => {
  renderEditor('/purchases/new')
  await userEvent.click(screen.getByRole('combobox', { name: 'Proveedor' }))
  await userEvent.click(screen.getByRole('option', { name: /Repuestos SA/ }))
  await userEvent.type(
    screen.getByLabelText('Referencia del proveedor'),
    'F-99',
  )
  await userEvent.type(
    screen.getByLabelText('Fecha del documento'),
    '2026-01-15',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Agregar línea' }))
  const line = screen.getByRole('group', { name: /Línea 1/ })
  await userEvent.click(
    within(line).getByRole('combobox', { name: 'Producto' }),
  )
  await userEvent.click(screen.getByRole('option', { name: /ACE-1 — Aceite/ }))
  await userEvent.type(
    within(line).getByLabelText('Cantidad de presentaciones'),
    '2',
  )
  await userEvent.type(
    within(line).getByLabelText('Costo unitario'),
    '0.335000',
  )
  await userEvent.selectOptions(
    within(line).getByLabelText('Recuperabilidad del impuesto'),
    'NON_RECOVERABLE',
  )
  expect(within(line).getByLabelText('Impuesto')).toHaveValue('9')
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar borrador' }),
  )
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
  expect(mocks.create.mock.calls[0]![0].data).toMatchObject({
    supplier_id: 1,
    supplier_reference: 'F-99',
    lines: [
      {
        product_id: 5,
        quantity: '2',
        unit_cost: '0.335000',
        tax_definition_id: 9,
        tax_recoverability: 'NON_RECOVERABLE',
      },
    ],
  })
})

it('las referencias inactivas se etiquetan y no pueden elegirse', async () => {
  renderEditor('/purchases/new')
  await userEvent.click(screen.getByRole('button', { name: 'Agregar línea' }))
  const line = screen.getByRole('group', { name: /Línea 1/ })
  await userEvent.click(
    within(line).getByRole('combobox', { name: 'Producto' }),
  )
  expect(
    screen.getByRole('option', { name: /OLD-1 — Bujía vieja/ }),
  ).toHaveAttribute('aria-disabled', 'true')
})

it('impide el doble envío mientras el guardado está en curso', async () => {
  let release!: (value: unknown) => void
  mocks.create.mockReturnValue(new Promise((resolve) => (release = resolve)))
  renderEditor('/purchases/new')
  await userEvent.click(screen.getByRole('combobox', { name: 'Proveedor' }))
  await userEvent.click(screen.getByRole('option', { name: /Repuestos SA/ }))
  await userEvent.type(screen.getByLabelText('Referencia del proveedor'), 'F-1')
  await userEvent.type(
    screen.getByLabelText('Fecha del documento'),
    '2026-01-15',
  )
  const save = screen.getByRole('button', { name: 'Guardar borrador' })
  await userEvent.click(save)
  await userEvent.click(screen.getByRole('button', { name: 'Guardando…' }))
  expect(mocks.create).toHaveBeenCalledTimes(1)
  release({ ...draftPurchase, id: 12 })
})

it('avisa de cambios sin guardar y pide confirmar antes de descartar', async () => {
  mocks.purchase = draftPurchase
  renderEditor('/purchases/11/edit')
  await userEvent.type(screen.getByLabelText('Observación'), 'nota')
  expect(screen.getByRole('status', { name: '' })).toBeDefined()
  expect(screen.getByText('Hay cambios sin guardar.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(await screen.findByRole('dialog')).toHaveTextContent(
    '¿Descartar los cambios?',
  )
})

it('la revisión nombra productos, cantidades y efecto sobre el stock con importes del backend', async () => {
  mocks.purchase = draftPurchase
  renderEditor('/purchases/11/edit')
  await userEvent.click(
    screen.getByRole('button', { name: 'Revisar y confirmar' }),
  )
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveTextContent('ACE-1')
  expect(dialog).toHaveTextContent('recibirá 2 presentaciones; pasa de 5 a 7')
  expect(
    within(dialog).getByLabelText('Totales calculados por el sistema'),
  ).toHaveTextContent('USD 22.00')
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Confirmar ingreso' }),
  )
  await waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(1))
  expect(mocks.confirm.mock.calls[0]![0]).toMatchObject({
    id: 11,
    expectedVersion: 3,
    reviewToken: 'token-1',
  })
  expect(await screen.findByText('detalle abierto')).toBeInTheDocument()
  expect(
    screen.getByRole('status', { name: 'Notificaciones' }),
  ).toHaveTextContent('confirmado')
})

it('review_required conserva la entrada, explica el cambio y solicita una revisión actualizada', async () => {
  mocks.purchase = draftPurchase
  mocks.confirm.mockRejectedValueOnce(
    new ProblemError('Cambió', 409, 'review_required'),
  )
  renderEditor('/purchases/11/edit')
  await userEvent.click(
    screen.getByRole('button', { name: 'Revisar y confirmar' }),
  )
  await userEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Confirmar ingreso',
    }),
  )
  expect(
    await screen.findByText(/cambiaron desde la revisión/),
  ).toBeInTheDocument()
  expect(mocks.preview).toHaveBeenCalledTimes(2)
  expect(screen.getByLabelText('Referencia del proveedor')).toHaveValue('F-1')
})

it('stale_record ofrece recargar sin sobrescribir automáticamente lo escrito', async () => {
  mocks.purchase = draftPurchase
  mocks.update.mockRejectedValueOnce(
    new ProblemError('Cambió', 409, 'stale_record'),
  )
  renderEditor('/purchases/11/edit')
  await userEvent.type(screen.getByLabelText('Observación'), 'mi cambio')
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar borrador' }),
  )
  expect(await screen.findByText('El ingreso cambió')).toBeInTheDocument()
  expect(screen.getByLabelText('Observación')).toHaveValue('mi cambio')
  await userEvent.click(
    screen.getByRole('button', { name: 'Recargar el ingreso' }),
  )
  expect(mocks.refetch).toHaveBeenCalled()
})

it('un ingreso confirmado no se edita', () => {
  mocks.purchase = { ...draftPurchase, state: 'CONFIRMED' }
  renderEditor('/purchases/11/edit')
  expect(
    screen.getByText('Este ingreso ya no es un borrador'),
  ).toBeInTheDocument()
})

it('cancelar la revisión no confirma nada y deja el borrador editable', async () => {
  mocks.purchase = draftPurchase
  renderEditor('/purchases/11/edit')
  await userEvent.click(
    screen.getByRole('button', { name: 'Revisar y confirmar' }),
  )
  const dialog = await screen.findByRole('dialog')
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Cancelar' }),
  )
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(mocks.confirm).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeEnabled()
})

it('no crea un segundo ingreso si se revisa antes de que se aplique la navegación al borrador creado', async () => {
  mocks.holdNavigation = true
  renderEditor('/purchases/new')
  await userEvent.click(screen.getByRole('combobox', { name: 'Proveedor' }))
  await userEvent.click(screen.getByRole('option', { name: /Repuestos SA/ }))
  await userEvent.type(screen.getByLabelText('Referencia del proveedor'), 'F-1')
  await userEvent.type(
    screen.getByLabelText('Fecha del documento'),
    '2026-01-15',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Guardar borrador' }),
  )
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
  await userEvent.click(
    screen.getByRole('button', { name: 'Revisar y confirmar' }),
  )
  await waitFor(() => expect(mocks.preview).toHaveBeenCalledWith(11))
  expect(mocks.create).toHaveBeenCalledTimes(1)
})
