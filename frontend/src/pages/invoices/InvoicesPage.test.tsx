import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  list: {} as Record<string, unknown>,
  args: [] as unknown[],
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: { permissions: mocks.permissions } }),
}))
vi.mock('@/features/fiscal/hooks', () => ({
  usePreparationList: (filters: unknown) => {
    mocks.args.push(filters)
    return mocks.list
  },
  usePreparation: (id: string) => ({
    isPending: false,
    data: {
      working: {
        receiver: {
          legal_name: id === 'a1b2' ? 'Luis Mora' : 'Ana Pérez',
          identification: '1710034065',
          email: 'cliente@example.com',
        },
      },
      summary: {
        lines: [
          {
            position: 1,
            description: 'Kit de embrague',
            quantity: '1',
            total: '50.00',
          },
        ],
      },
    },
  }),
}))
vi.mock('@/shared/api/entity-logos', () => ({
  useBusinessName: (scope: string) =>
    scope === 'commercial' ? 'Repuestos' : 'Servicios',
  useIssuerBrand: () => ({
    logoUrl: null,
    legalName: undefined,
    displayName: undefined,
  }),
}))

import { InvoicesPage } from './InvoicesPage'

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'a1b2',
  entity: 'COMERCIAL',
  fiscal_entity_id: 1,
  source_kind: 'COMMERCIAL',
  source_id: 5,
  state: 'DRAFT',
  number: 'COM-VEN-000005',
  customer_name: 'Luis Mora',
  total: '50.00',
  source_date: '2026-10-02',
  created_at: '2026-10-02T15:00:00Z',
  ...overrides,
})

function page(results: unknown[]) {
  return {
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

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname + location.search}</p>
}

function renderPage(path = '/invoices') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <>
              <InvoicesPage />
              <Where />
            </>
          }
          path="/invoices"
        />
        <Route element={<Where />} path="/fiscal/preparations/:id" />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.args.length = 0
  mocks.permissions = ['fiscal.comercial.ver', 'fiscal.artesanal.ver']
  mocks.list = page([
    row(),
    row({
      id: 'c3d4',
      entity: 'ARTESANAL',
      state: 'PREPARED',
      number: 'ART-SER-000009',
      customer_name: 'Ana Pérez',
      total: '25.00',
    }),
  ])
})

it('muestra los dos negocios con su estado local, sin ninguna marca de autorización', () => {
  renderPage()

  const table = screen.getByRole('table', { name: 'Facturas' })
  expect(within(table).getByText('COM-VEN-000005')).toBeVisible()
  expect(within(table).getByText('ART-SER-000009')).toBeVisible()
  expect(within(table).getByText('Borrador')).toBeVisible()
  expect(within(table).getByText('Preparada, sin enviar')).toBeVisible()
  expect(within(table).getByRole('img', { name: 'Repuestos' })).toBeVisible()
  expect(within(table).getByRole('img', { name: 'Servicios' })).toBeVisible()
  expect(within(table).getByText('USD 50.00')).toBeVisible()
  // La descripción aclara que no hay emisión real; ninguna fila se presenta como autorizada.
  expect(table.textContent).not.toMatch(/autorizad|emitid|enviada al SRI/i)
  expect(mocks.args.at(-1)).toEqual({
    entity: undefined,
    state: undefined,
    page: 1,
  })
})

it('cada fila enlaza a su preparación y los filtros viven en la URL', async () => {
  const user = userEvent.setup()
  renderPage()

  await user.click(screen.getAllByRole('link', { name: 'COM-VEN-000005' })[0]!)
  expect(screen.getByTestId('where')).toHaveTextContent(
    '/fiscal/preparations/a1b2',
  )
})

it('filtra por estado y por negocio desde la URL', async () => {
  const user = userEvent.setup()
  renderPage('/invoices?entity=ARTESANAL&state=PREPARED')
  expect(mocks.args.at(-1)).toMatchObject({
    entity: 'ARTESANAL',
    state: 'PREPARED',
  })

  await user.click(screen.getByRole('radio', { name: 'Borrador' }))
  expect(screen.getByTestId('where')).toHaveTextContent('state=DRAFT')
})

it('elegir una fila muestra su detalle sin PDF ni reenvío y conserva la página', async () => {
  const user = userEvent.setup()
  renderPage('/invoices?page=2')
  const preview = screen.getByRole('complementary', {
    name: 'Detalle de la factura',
  })
  expect(within(preview).getByText('Factura de Repuestos')).toBeVisible()
  expect(within(preview).getByText('Kit de embrague')).toBeVisible()

  await user.click(
    within(screen.getByRole('table', { name: 'Facturas' })).getByText(
      /Ana Pérez/,
    ),
  )
  expect(screen.getByTestId('where')).toHaveTextContent('selected=c3d4')
  expect(screen.getByTestId('where')).toHaveTextContent('page=2')
  const chosen = screen.getByRole('complementary', {
    name: 'Detalle de la factura',
  })
  expect(within(chosen).getByText('Factura de Servicios')).toBeVisible()
  expect(chosen.textContent).not.toMatch(/PDF|Reenviar|autorizad/i)
})

it('quien solo consulta un negocio no ve el filtro de negocio ni puede pedir el otro', () => {
  mocks.permissions = ['fiscal.artesanal.ver']
  renderPage('/invoices?entity=COMERCIAL')

  expect(screen.queryByLabelText('Negocio')).toBeNull()
  expect(mocks.args.at(-1)).toMatchObject({ entity: undefined })
})

it('sin preparaciones explica que todavía no hay facturas, sin afirmar conexión con el SRI', () => {
  mocks.list = page([])
  renderPage()

  expect(screen.getByRole('heading', { name: 'No hay facturas' })).toBeVisible()
  expect(screen.getByText(/Todavía no hay facturas/)).toBeVisible()
  expect(document.body.textContent).not.toMatch(/conectad|enviad/i)
})
