import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  review: vi.fn(),
  register: vi.fn(),
}))

vi.mock('@/features/products/api', () => ({
  productsApi: { list: mocks.list },
}))
vi.mock('@/features/purchases/pickers', () => ({
  useProductSuggestions: () => ({ data: undefined }),
  useSupplierOptions: () => ({
    isPending: false,
    isError: false,
    data: { totalPages: 1, options: [{ id: 3, label: 'Repuestos SA' }] },
  }),
}))
vi.mock('@/features/purchases/hooks', () => ({
  usePurchaseMutations: () => ({
    review: { mutateAsync: mocks.review },
    register: { mutateAsync: mocks.register },
  }),
}))

import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

import { EntryPage } from './EntryPage'

const product = (id: number, code: string, name: string) => ({
  id,
  code,
  manufacturer_code: '',
  name,
  unit: { id: 1, name: 'Unidad', is_active: true },
})
const oil = product(1, 'ACE-1', 'Aceite')
const filter = product(2, 'FIL-1', 'Filtro')

const reviewOf = (extra: Record<string, unknown> = {}) => ({
  can_confirm: true,
  issues: [],
  summary: { products: 1, units: 1 },
  supplier: null,
  reference: '',
  observation: '',
  lines: [
    {
      product_id: 1,
      code: 'ACE-1',
      name: 'Aceite',
      unit_name: 'Unidad',
      unit_symbol: 'u',
      quantity: '1',
    },
  ],
  duplicates: [],
  requires_acknowledgement: false,
  ...extra,
})

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/purchases/new']}>
      <ToastProvider>
        <Routes>
          <Route element={<EntryPage />} path="/purchases/new" />
          <Route element={<Where />} path="/purchases" />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

const search = () => screen.getByRole('combobox', { name: /buscar producto/i })

async function addByCode(code: string) {
  await userEvent.type(search(), `${code}{Enter}`)
  await waitFor(() => expect(search()).toHaveValue(''))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.list.mockImplementation(({ search: term }: { search: string }) =>
    Promise.resolve({
      results: [oil, filter].filter(
        (p) => p.code.toLowerCase() === term.toLowerCase(),
      ),
    }),
  )
  mocks.review.mockResolvedValue(reviewOf())
  mocks.register.mockResolvedValue({ id: 9, internal_number: 'COM-ING-000009' })
})

describe('EntryPage: registro sencillo', () => {
  it('empieza con el cursor en el buscador y sin pedir datos obligatorios', () => {
    renderPage()
    expect(search()).toHaveFocus()
    expect(screen.getByText('Aún no agregó productos')).toBeInTheDocument()
    expect(screen.getByText('Nada por registrar')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Revisar y confirmar' }),
    ).toBeDisabled()
    expect(screen.queryByText(/impuesto|fecha del documento|total/i)).toBeNull()
    expect(screen.queryByLabelText('Proveedor')).toBeNull()
  })

  it('agrega por código con Enter, sube la cantidad al repetir y devuelve el foco', async () => {
    renderPage()
    await addByCode('ACE-1')
    const list = screen.getByRole('list', { name: 'Productos de la entrada' })
    expect(within(list).getByLabelText('Cantidad de ACE-1')).toHaveValue('1')
    expect(search()).toHaveFocus()
    await addByCode('ace-1')
    expect(within(list).getByLabelText('Cantidad de ACE-1')).toHaveValue('2')
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('1 producto · 2 unidades')).toBeInTheDocument()
  })

  it('ajusta la cantidad con más, menos o escribiendo, y quita líneas', async () => {
    renderPage()
    await addByCode('ACE-1')
    await addByCode('FIL-1')
    await userEvent.click(
      screen.getByRole('button', { name: 'Agregar una unidad de ACE-1' }),
    )
    expect(screen.getByLabelText('Cantidad de ACE-1')).toHaveValue('2')
    expect(
      screen.getByRole('button', { name: 'Quitar una unidad de FIL-1' }),
    ).toBeDisabled()
    await userEvent.clear(screen.getByLabelText('Cantidad de FIL-1'))
    await userEvent.type(screen.getByLabelText('Cantidad de FIL-1'), '5')
    expect(screen.getByText('2 productos · 7 unidades')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Quitar ACE-1' }))
    expect(screen.queryByLabelText('Cantidad de ACE-1')).toBeNull()
  })

  it('una cantidad inválida se marca en su línea y no llama al servidor', async () => {
    renderPage()
    await addByCode('ACE-1')
    await userEvent.clear(screen.getByLabelText('Cantidad de ACE-1'))
    await userEvent.type(screen.getByLabelText('Cantidad de ACE-1'), '1.5')
    await userEvent.click(
      screen.getByRole('button', { name: 'Revisar y confirmar' }),
    )
    expect(
      screen.getByText('Use un número entero mayor que cero.'),
    ).toBeInTheDocument()
    expect(mocks.review).not.toHaveBeenCalled()
  })

  it('los detalles opcionales permanecen plegados hasta pedirlos', async () => {
    renderPage()
    const toggle = screen.getByRole('button', { name: /más detalles/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    expect(screen.getByLabelText('Referencia')).toBeInTheDocument()
    expect(screen.getByLabelText('Observación')).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Registrar costos' }),
    ).not.toBeChecked()
    expect(screen.queryByLabelText(/Costo de/)).toBeNull()
  })

  it('el campo de costo aparece solo al activarlo, vacío significa sin costo', async () => {
    renderPage()
    await addByCode('ACE-1')
    await userEvent.click(screen.getByRole('button', { name: /más detalles/i }))
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Registrar costos' }),
    )
    const cost = screen.getByLabelText('Costo de ACE-1')
    expect(cost).toHaveAttribute('placeholder', 'Sin costo')
    await userEvent.type(cost, '4.5')
    await userEvent.click(
      screen.getByRole('button', { name: 'Revisar y confirmar' }),
    )
    await waitFor(() => expect(mocks.review).toHaveBeenCalled())
    expect(mocks.review).toHaveBeenCalledWith({
      lines: [{ product_id: 1, quantity: '1', unit_cost: '4.5' }],
    })
  })
})

describe('EntryPage: revisión y confirmación', () => {
  it('flujo mínimo: busca, revisa y confirma sin abrir detalles', async () => {
    renderPage()
    await addByCode('ACE-1')
    await userEvent.click(
      screen.getByRole('button', { name: 'Revisar y confirmar' }),
    )
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(mocks.review).toHaveBeenCalledWith({
      lines: [{ product_id: 1, quantity: '1' }],
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirmar entrada' }),
    )
    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1))
    const call = mocks.register.mock.calls[0]?.[0] as {
      input: unknown
      key: string
    }
    expect(call.input).toEqual({ lines: [{ product_id: 1, quantity: '1' }] })
    expect(call.key).toBeTruthy()
  })

  it('tras confirmar avisa con toast, vacía el formulario y devuelve el foco', async () => {
    renderPage()
    await addByCode('ACE-1')
    await userEvent.click(
      screen.getByRole('button', { name: 'Revisar y confirmar' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirmar entrada' }),
    )
    expect(
      await screen.findByText('Entrada COM-ING-000009 registrada.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver entrada' })).toHaveAttribute(
      'href',
      '/purchases/9',
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByLabelText('Cantidad de ACE-1')).toBeNull()
    expect(screen.getByText('Nada por registrar')).toBeInTheDocument()
    expect(search()).toHaveFocus()
  })

  it('cancelar la revisión conserva lo escrito', async () => {
    renderPage()
    await addByCode('ACE-1')
    await userEvent.click(
      screen.getByRole('button', { name: 'Revisar y confirmar' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancelar' }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Cantidad de ACE-1')).toBeInTheDocument()
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it('un posible duplicado exige reconocerlo y envía su identificador', async () => {
    mocks.review.mockResolvedValue(
      reviewOf({
        requires_acknowledgement: true,
        duplicates: [
          {
            purchase_id: 4,
            internal_number: 'COM-ING-000004',
            confirmed_at: null,
          },
        ],
      }),
    )
    renderPage()
    await addByCode('ACE-1')
    await userEvent.click(
      screen.getByRole('button', { name: 'Revisar y confirmar' }),
    )
    const confirm = await screen.findByRole('button', {
      name: 'Confirmar entrada',
    })
    expect(confirm).toBeDisabled()
    await userEvent.click(
      screen.getByRole('checkbox', { name: /otra entrada/i }),
    )
    await userEvent.click(confirm)
    await waitFor(() => expect(mocks.register).toHaveBeenCalled())
    expect(
      (mocks.register.mock.calls[0]?.[0] as { input: unknown }).input,
    ).toEqual({
      lines: [{ product_id: 1, quantity: '1' }],
      acknowledged_entry_ids: [4],
    })
  })

  it('si aparece un duplicado al confirmar, pide revisar de nuevo sin perder datos', async () => {
    mocks.register.mockRejectedValueOnce(
      new ProblemError('Ya hay una entrada igual.', 409, 'possible_duplicate'),
    )
    renderPage()
    await addByCode('ACE-1')
    await userEvent.click(
      screen.getByRole('button', { name: 'Revisar y confirmar' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirmar entrada' }),
    )
    expect(
      await screen.findByText(/se registró una entrada igual/i),
    ).toBeInTheDocument()
    expect(mocks.review).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('Cantidad de ACE-1')).toBeInTheDocument()
  })

  it('una falla definitiva cierra el diálogo, explica el problema y conserva lo escrito', async () => {
    mocks.register.mockRejectedValueOnce(
      new ProblemError(
        'Falta la serie COM-ING.',
        409,
        'configuration_missing',
        undefined,
        { series: ['Falta la serie COM-ING.'] },
      ),
    )
    renderPage()
    await addByCode('ACE-1')
    await userEvent.click(
      screen.getByRole('button', { name: 'Revisar y confirmar' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirmar entrada' }),
    )
    expect(
      await screen.findByText('No se registró la entrada'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('Cantidad de ACE-1')).toBeInTheDocument()
  })

  it('un reintento tras un resultado incierto reutiliza la clave', async () => {
    mocks.register.mockRejectedValueOnce(
      new ProblemError('Sin respuesta', 0, 'network_error'),
    )
    renderPage()
    await addByCode('ACE-1')
    await userEvent.click(
      screen.getByRole('button', { name: 'Revisar y confirmar' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirmar entrada' }),
    )
    await screen.findByText('No se registró la entrada')
    await userEvent.click(
      screen.getByRole('button', { name: 'Revisar y confirmar' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Confirmar entrada' }),
    )
    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(2))
    const [first, second] = mocks.register.mock.calls.map(
      (c) => (c[0] as { key: string }).key,
    )
    expect(first).toBe(second)
  })

  it('editar después de revisar descarta la revisión anterior', async () => {
    renderPage()
    await addByCode('ACE-1')
    await userEvent.click(
      screen.getByRole('button', { name: 'Revisar y confirmar' }),
    )
    await screen.findByRole('dialog')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Agregar una unidad de ACE-1' }),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('EntryPage: salida', () => {
  it('cancelar sin datos vuelve a la lista', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/purchases')
  })

  it('cancelar con datos pide confirmar el descarte', async () => {
    renderPage()
    await addByCode('ACE-1')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByText('¿Descartar la entrada?')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Seguir editando' }),
    )
    expect(screen.getByLabelText('Cantidad de ACE-1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Descartar y salir' }),
    )
    expect(screen.getByTestId('where')).toHaveTextContent('/purchases')
  })

  it('avisa antes de cerrar la pestaña solo si hay algo escrito', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    renderPage()
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(false)
    await addByCode('ACE-1')
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true)
    add.mockRestore()
  })
})
