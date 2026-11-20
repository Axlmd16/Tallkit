import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  list: {} as Record<string, unknown>,
  args: [] as unknown[],
}))

vi.mock('@/features/sales/SalesOverview', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  SalesOverview: () => null,
}))
vi.mock('@/shared/api/entity-logos', () => ({
  useIssuerBrand: () => ({
    logoUrl: null,
    legalName: undefined,
    displayName: 'Repuestos Jiménez',
  }),
}))
vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/proformas/hooks', () => ({
  useProformas: (filters: unknown) => {
    mocks.args.push(filters)
    return mocks.list
  },
}))

import { ProformasPage } from './ProformasPage'

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  state: 'VALID',
  version: 2,
  internal_number: 'COM-PRO-000007',
  customer: { id: 3, name: 'Ana Pérez' },
  issue_date: '2026-10-06',
  valid_until: '2026-10-13',
  grand_total: '23.00',
  origin: null,
  sale: null,
  allowed_actions: ['convert', 'void', 'copy', 'print'],
  ...overrides,
})

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderPage(path = '/proformas') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <>
              <ProformasPage />
              <Where />
            </>
          }
          path="/proformas"
        />
        <Route element={<Where />} path="/proformas/new" />
        <Route element={<Where />} path="/proformas/:id" />
        <Route element={<Where />} path="/proformas/:id/edit" />
      </Routes>
    </MemoryRouter>,
  )
}

function setRows(results: unknown[]) {
  mocks.list = {
    isPending: false,
    isError: false,
    data: {
      count: results.length,
      page: 1,
      page_size: 20,
      total_pages: 1,
      results,
    },
  }
}

beforeEach(() => {
  mocks.args.length = 0
  mocks.permissions = ['proformas.ver', 'proformas.gestionar']
  setRows([row()])
})

it('muestra número, cliente, emisión, vigencia, total y estado con texto', () => {
  renderPage()
  const table = screen.getByRole('table', { name: 'Proformas' })
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent),
  ).toEqual([
    'Número',
    'Cliente',
    'Emisión',
    'Vigente hasta',
    'Estado',
    'Venta',
    'Total USD',
    'Acciones',
  ])
  expect(within(table).getByText('COM-PRO-000007')).toHaveClass('code')
  expect(within(table).getByText('Ana Pérez')).toBeInTheDocument()
  expect(within(table).getByText('06/10/2026')).toBeInTheDocument()
  expect(within(table).getByText('13/10/2026')).toBeInTheDocument()
  expect(within(table).getByText('Vigente')).toBeInTheDocument()
  expect(within(table).getByText('USD 23.00')).toBeInTheDocument()
})

it('cada estado se distingue por su texto y un borrador no inventa número', () => {
  setRows([
    row({ id: 1, state: 'DRAFT', internal_number: null, issue_date: null }),
    row({ id: 2, state: 'EXPIRED' }),
    row({
      id: 3,
      state: 'CONVERTED',
      sale: { id: 9, internal_number: 'COM-VEN-000004', state: 'CONFIRMED' },
    }),
    row({ id: 4, state: 'VOIDED' }),
  ])
  renderPage()
  const table = screen.getByRole('table', { name: 'Proformas' })
  for (const label of ['Borrador', 'Vencida', 'Convertida', 'Anulada']) {
    expect(within(table).getByText(label)).toBeInTheDocument()
  }
  expect(within(table).getByText('Sin número')).toBeInTheDocument()
  expect(within(table).getByText('COM-VEN-000004')).toBeInTheDocument()
})

it('busca por número o cliente y filtra por estado conservándolos en la URL', async () => {
  const user = userEvent.setup()
  renderPage('/proformas?search=ana&state=CONVERTED')
  expect(mocks.args.at(-1)).toEqual({
    search: 'ana',
    state: 'CONVERTED',
    expiresWithinDays: undefined,
    page: 1,
  })
  expect(
    screen.getByRole('searchbox', { name: 'Buscar proformas' }),
  ).toHaveValue('ana')
  await user.click(screen.getByRole('radio', { name: 'Vencidas' }))
  expect(screen.getByTestId('where')).toHaveTextContent('state=EXPIRED')
  expect(mocks.args.at(-1)).toMatchObject({ state: 'EXPIRED', search: 'ana' })
  await user.click(screen.getByRole('radio', { name: 'Todas' }))
  expect(mocks.args.at(-1)).toMatchObject({ state: undefined })
})

it('abre el detalle conservando los filtros para volver', async () => {
  const user = userEvent.setup()
  renderPage('/proformas?state=VALID')
  await user.click(
    within(screen.getByRole('table', { name: 'Proformas' })).getByText(
      'COM-PRO-000007',
    ),
  )
  expect(screen.getByTestId('where')).toHaveTextContent('/proformas/7')
})

it('ofrece crear solo con permiso de gestión', async () => {
  const user = userEvent.setup()
  const first = renderPage()
  await user.click(screen.getByRole('button', { name: 'Nueva proforma' }))
  expect(screen.getByTestId('where')).toHaveTextContent('/proformas/new')
  first.unmount()
  mocks.permissions = ['proformas.ver']
  renderPage()
  expect(screen.queryByRole('button', { name: 'Nueva proforma' })).toBeNull()
})

it('editar aparece solo cuando el servidor lo permite', async () => {
  const user = userEvent.setup()
  setRows([
    row({
      id: 1,
      state: 'DRAFT',
      internal_number: null,
      allowed_actions: ['edit'],
    }),
  ])
  const first = renderPage()
  await user.click(
    screen.getAllByRole('button', {
      name: 'Acciones de proforma sin número',
    })[0]!,
  )
  await user.click(
    await screen.findByRole('menuitem', { name: 'Editar borrador' }),
  )
  expect(screen.getByTestId('where')).toHaveTextContent('/proformas/1/edit')
  first.unmount()
  setRows([row()])
  renderPage()
  await user.click(
    screen.getAllByRole('button', { name: 'Acciones de COM-PRO-000007' })[0]!,
  )
  expect(screen.queryByRole('menuitem', { name: 'Editar borrador' })).toBeNull()
})

it('distingue vacío, sin coincidencias y error', () => {
  setRows([])
  const empty = renderPage()
  expect(screen.getByText('No hay proformas')).toBeInTheDocument()
  empty.unmount()
  mocks.list = { isPending: false, isError: true }
  renderPage()
  expect(
    screen.getByText(/No fue posible consultar las proformas/),
  ).toBeInTheDocument()
})

it('una proforma sin cliente se lista como «Sin cliente»', () => {
  setRows([row({ customer: null })])
  renderPage()
  expect(
    within(screen.getByRole('table', { name: 'Proformas' })).getByText(
      'Sin cliente',
    ),
  ).toBeInTheDocument()
})

it('«Por vencer» llega filtrada desde el inicio y puede quitarse', async () => {
  const user = userEvent.setup()
  renderPage('/proformas?state=VALID&expires_within_days=1')
  expect(mocks.args.at(-1)).toEqual({
    search: undefined,
    state: 'VALID',
    expiresWithinDays: 1,
    page: 1,
  })
  expect(screen.getByRole('radio', { name: 'Por vencer' })).toBeChecked()
  await user.click(screen.getByRole('radio', { name: 'Todas' }))
  expect(screen.getByTestId('where')).toHaveTextContent(/^\/proformas$/)
  expect(mocks.args.at(-1)).toMatchObject({
    state: undefined,
    expiresWithinDays: undefined,
  })
  await user.click(screen.getByRole('radio', { name: 'Por vencer' }))
  expect(screen.getByTestId('where')).toHaveTextContent(
    'state=VALID&expires_within_days=1',
  )
})
