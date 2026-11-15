import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

type Query = {
  isPending: boolean
  isError: boolean
  data?: unknown
  refetch: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => ({
  session: {
    username: 'ana',
    roles: ['VENDEDOR'],
    permissions: [] as string[],
  },
  pending: {} as Record<string, unknown>,
  collections: {} as Record<string, unknown>,
  enabled: {} as Record<string, boolean>,
  orderCalls: [] as unknown[],
  salesCalls: [] as { filters: unknown; enabled: boolean | undefined }[],
  artisanCalls: [] as { filters: unknown; enabled: boolean | undefined }[],
  navigate: vi.fn(),
}))

vi.mock('react-router', async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal()
  return { ...actual, useNavigate: () => mocks.navigate }
})
vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: mocks.session }),
}))
vi.mock('@/features/home/hooks', () => ({
  useHomePending: (enabled: boolean) => {
    mocks.enabled.pending = enabled
    return mocks.pending
  },
  useHomeCollections: (enabled: boolean) => {
    mocks.enabled.collections = enabled
    return mocks.collections
  },
}))
vi.mock('@/shared/api/entity-logos', () => ({
  useBusinessName: (scope: string) =>
    scope === 'commercial' ? 'Almacén' : 'Taller',
  useIssuerBrand: (scope: string) => ({
    logoUrl: null,
    legalName: undefined,
    displayName: scope === 'COMERCIAL' ? 'Almacén' : 'Taller',
  }),
}))
vi.mock('@/features/maintenance/hooks', () => ({
  useMaintenanceOrders: (filters: unknown) => {
    mocks.orderCalls.push(filters)
    return {
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      data: {
        count: 7,
        status_counts: { all: 9, open: 7, finalized: 2 },
        results: [
          {
            id: 7,
            number: 'ART-OT-000007',
            state: 'REGISTERED',
            opened_on: '2026-10-05',
            services_total: '85.00',
            customer: { name: 'Ana Pérez' },
            vehicle: { plate: 'ABC-1234', brand: 'Chevrolet', model: 'D-Max' },
          },
        ],
      },
    }
  },
}))
vi.mock('@/features/sales/hooks', () => ({
  useReceivables: (filters: unknown, enabled?: boolean) => {
    mocks.salesCalls.push({ filters, enabled })
    return {
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      data:
        enabled === false
          ? undefined
          : {
              count: 1,
              results: [
                {
                  id: 31,
                  internal_number: 'COM-VEN-000031',
                  sale_date: '2026-10-01',
                  condition: 'CREDITO',
                  age_days: 12,
                  customer: { name: 'Luis Mora' },
                  money: { balance: '300.00' },
                },
              ],
            },
    }
  },
}))
vi.mock('@/features/maintenance/billingHooks', () => ({
  useArtisanReceivables: (filters: unknown, enabled?: boolean) => {
    mocks.artisanCalls.push({ filters, enabled })
    return {
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      data:
        enabled === false
          ? undefined
          : {
              results: [
                {
                  id: 9,
                  internal_number: 'ART-SER-000009',
                  customer_name: 'Ana Pérez',
                  condition: 'CONTADO',
                  age_days: 2,
                  operational_date: '2026-10-04',
                  balance: '120.00',
                },
                {
                  id: 10,
                  internal_number: 'ART-SER-000010',
                  customer_name: 'Pagado Ya',
                  condition: 'CONTADO',
                  age_days: 5,
                  operational_date: '2026-10-03',
                  balance: '0.00',
                },
              ],
            },
    }
  },
}))

vi.mock('@/features/maintenance/NewMaintenanceDialog', () => ({
  NewMaintenanceDialog: ({ initialSearch }: { initialSearch?: string }) => (
    <div role="dialog" aria-label="Nuevo mantenimiento">
      {initialSearch ?? ''}
    </div>
  ),
}))

import { HomePage } from './HomePage'

const SELLER = [
  'ventas.ver',
  'ventas.crear',
  'proformas.ver',
  'proformas.gestionar',
  'ingresos.crear',
  'pagos_comerciales.ver',
  'pagos_comerciales.registrar',
]
const MANAGER = [
  'mantenimientos.ver',
  'mantenimientos.gestionar',
  'pagos_artesanales.ver',
  'pagos_artesanales.registrar',
]
const ADMIN = [...SELLER, ...MANAGER, 'parametros.gestionar', 'usuarios.ver']

const ok = (data: unknown): Query => ({
  isPending: false,
  isError: false,
  data,
  refetch: vi.fn(),
})
const loading = (): Query => ({
  isPending: true,
  isError: false,
  refetch: vi.fn(),
})
const failed = (): Query => ({
  isPending: false,
  isError: true,
  refetch: vi.fn(),
})

const day = (date: string, amount: string) => ({ date, amount })
const collections = (items: unknown[]) =>
  ok({ timezone: 'America/Guayaquil', items })
const COMMERCIAL_DAYS = [
  day('2026-10-05', '40.00'),
  day('2026-10-06', '300.50'),
]
const ARTISAN_DAYS = [day('2026-10-05', '10.00'), day('2026-10-06', '120.00')]

function asSeller() {
  mocks.session = { username: 'ana', roles: ['VENDEDOR'], permissions: SELLER }
  mocks.pending = ok({ items: [], qualification: null })
  mocks.collections = collections([
    { scope: 'commercial', total: '340.50', days: COMMERCIAL_DAYS },
  ])
}

function asAdmin() {
  mocks.session = {
    username: 'root',
    roles: ['ADMINISTRADOR'],
    permissions: ADMIN,
  }
  mocks.pending = ok({ items: [], qualification: null })
  mocks.collections = collections([
    { scope: 'commercial', total: '340.50', days: COMMERCIAL_DAYS },
    { scope: 'artisan', total: '130.00', days: ARTISAN_DAYS },
  ])
}

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  // Mediodía del 6 de octubre en Guayaquil (UTC-5): «hoy» para «Cobrado hoy».
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-06T17:00:00Z') })
  mocks.enabled = {}
  mocks.orderCalls.length = 0
  mocks.salesCalls.length = 0
  mocks.artisanCalls.length = 0
  mocks.navigate.mockReset()
  asSeller()
})
afterEach(() => vi.useRealTimers())

// --- Banda del mostrador -----------------------------------------------------------------

it('pregunta qué llegó al taller y muestra la fecha de hoy', () => {
  asAdmin()
  renderPage()
  expect(
    screen.getByRole('heading', { level: 1, name: '¿Qué llegó al taller?' }),
  ).toBeVisible()
  expect(screen.getByText('Martes 6 de octubre')).toBeVisible()
})

it('un Vendedor ve «Venta rápida» y la búsqueda de ventas, pero no «Nuevo mantenimiento»', () => {
  renderPage()
  expect(screen.getByRole('link', { name: 'Venta rápida' })).toHaveAttribute(
    'href',
    '/sales/quick',
  )
  expect(
    screen.queryByRole('button', { name: 'Nuevo mantenimiento' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('search')).toBeVisible()
})

it('quien gestiona mantenimientos tiene «Nuevo mantenimiento» y no «Venta rápida»', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mocks.session = {
    username: 'luis',
    roles: ['ENCARGADO_TALLER'],
    permissions: MANAGER,
  }
  mocks.collections = collections([
    { scope: 'artisan', total: '130.00', days: ARTISAN_DAYS },
  ])
  renderPage()
  expect(
    screen.queryByRole('link', { name: 'Venta rápida' }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Nuevo mantenimiento' }))
  expect(
    screen.getByRole('dialog', { name: 'Nuevo mantenimiento' }),
  ).toBeVisible()
})

it('la búsqueda abre la lista filtrada del taller o, sin permiso, la de ventas', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  asAdmin()
  const first = renderPage()
  await user.type(screen.getByRole('searchbox'), 'ABC 12{Enter}')
  expect(mocks.navigate).toHaveBeenCalledWith('/maintenance?search=ABC%2012')
  first.unmount()

  asSeller()
  renderPage()
  await user.type(screen.getByRole('searchbox'), 'Mora{Enter}')
  expect(mocks.navigate).toHaveBeenLastCalledWith('/sales?search=Mora')
})

// --- Cobrado hoy -------------------------------------------------------------------------

it('«Cobrado hoy» muestra el importe de hoy de cada negocio y ningún total conjunto', () => {
  asAdmin()
  renderPage()
  const cash = screen.getByRole('region', { name: 'Cobrado hoy' })
  expect(within(cash).getByText('USD 300.50')).toBeVisible()
  expect(within(cash).getByText('USD 120.00')).toBeVisible()
  expect(within(cash).queryByText('USD 420.50')).toBeNull()
  // Solo hoy: los importes de días anteriores no aparecen.
  expect(within(cash).queryByText('USD 40.00')).toBeNull()
  expect(within(cash).getByText('Almacén')).toBeVisible()
  expect(within(cash).getByText('Taller')).toBeVisible()
})

it('un día sin cobros de un negocio no se muestra como cero inventado', () => {
  mocks.collections = collections([
    { scope: 'commercial', total: '40.00', days: [day('2026-10-05', '40.00')] },
  ])
  renderPage()
  const cash = screen.getByRole('region', { name: 'Cobrado hoy' })
  expect(cash).not.toHaveTextContent('USD 0.00')
})

it('si fallan los cobros, el resto de Inicio sigue operable', () => {
  mocks.collections = failed()
  renderPage()
  expect(
    screen.queryByRole('region', { name: 'Cobrado hoy' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Venta rápida' })).toBeVisible()
  expect(screen.getByRole('region', { name: 'Falta cobrar' })).toBeVisible()
})

// --- En el taller y Falta cobrar ---------------------------------------------------------

it('«En el taller» muestra una tarjeta por mantenimiento abierto con su contador', () => {
  asAdmin()
  renderPage()
  const workshop = screen.getByRole('region', { name: 'En el taller' })
  expect(
    within(workshop).getByRole('link', { name: /ABC-1234/ }),
  ).toHaveAttribute('href', '/maintenance/7')
  expect(within(workshop).getByText('Ana Pérez')).toBeVisible()
  expect(within(workshop).getByText('Chevrolet D-Max')).toBeVisible()
  expect(within(workshop).getByText('ART-OT-000007')).toBeVisible()
  expect(within(workshop).getByText('7')).toBeVisible()
  expect(mocks.orderCalls.at(-1)).toMatchObject({ state: 'OPEN', pageSize: 5 })
  expect(
    within(workshop).getByRole('link', { name: 'Ver todos' }),
  ).toHaveAttribute('href', '/maintenance?state=OPEN')
})

it('«Falta cobrar» lleva cada cuenta a su cobro, con su negocio y sin total conjunto', () => {
  asAdmin()
  renderPage()
  const owed = screen.getByRole('region', { name: 'Falta cobrar' })
  expect(within(owed).getByText('USD 300.00')).toBeVisible()
  expect(within(owed).getByText('USD 120.00')).toBeVisible()
  expect(within(owed).getByText('Almacén')).toBeVisible()
  expect(within(owed).getByText('Taller')).toBeVisible()
  expect(within(owed).queryByText('USD 420.00')).toBeNull()
  // La cuenta artesanal ya pagada no es una deuda.
  expect(within(owed).queryByText('ART-SER-000010')).toBeNull()
  const links = within(owed)
    .getAllByRole('link', { name: 'Cobrar' })
    .map((link) => link.getAttribute('href'))
  // Las tarjetas de los dos negocios se ordenan juntas por fecha, la más reciente primero.
  expect(links).toEqual(['/maintenance/service-operations/9', '/sales/31'])
  expect(mocks.salesCalls.at(-1)?.filters).toMatchObject({
    onlyDebt: true,
    pageSize: 5,
  })
})

it('sin permiso de registrar cobros, la cuenta se ve pero no ofrece «Cobrar»', () => {
  mocks.session.permissions = ['pagos_comerciales.ver', 'ventas.ver']
  renderPage()
  const owed = screen.getByRole('region', { name: 'Falta cobrar' })
  expect(within(owed).queryByRole('link', { name: 'Cobrar' })).toBeNull()
  expect(within(owed).getByRole('link', { name: 'Ver' })).toHaveAttribute(
    'href',
    '/sales/31',
  )
})

it('un Vendedor no ve «En el taller» ni consulta lo del negocio artesanal', () => {
  renderPage()
  expect(screen.queryByRole('region', { name: 'En el taller' })).toBeNull()
  const owed = screen.getByRole('region', { name: 'Falta cobrar' })
  expect(within(owed).queryByText('ART-SER-000009')).toBeNull()
  expect(mocks.orderCalls).toHaveLength(0)
  expect(mocks.artisanCalls.every((call) => call.enabled === false)).toBe(true)
  expect(mocks.salesCalls.some((call) => call.enabled !== false)).toBe(true)
})

it('un Encargado del taller no consulta ni ve lo comercial', () => {
  mocks.session = {
    username: 'luis',
    roles: ['ENCARGADO_TALLER'],
    permissions: MANAGER,
  }
  mocks.collections = collections([
    { scope: 'artisan', total: '130.00', days: ARTISAN_DAYS },
  ])
  renderPage()
  const owed = screen.getByRole('region', { name: 'Falta cobrar' })
  expect(within(owed).queryByText('COM-VEN-000031')).toBeNull()
  expect(within(owed).getByText('ART-SER-000009')).toBeVisible()
  expect(mocks.salesCalls.every((call) => call.enabled === false)).toBe(true)
  expect(mocks.enabled).toEqual({ pending: false, collections: true })
})

it('sin permisos de cuentas no aparece «Falta cobrar» ni se consultan los cobros', () => {
  mocks.session.permissions = ['mantenimientos.ver']
  renderPage()
  expect(screen.queryByRole('region', { name: 'Falta cobrar' })).toBeNull()
  expect(screen.queryByRole('region', { name: 'Cobrado hoy' })).toBeNull()
  expect(screen.getByRole('region', { name: 'En el taller' })).toBeVisible()
  expect(mocks.enabled.collections).toBe(false)
})

// --- Estados -----------------------------------------------------------------------------

it('mientras cargan los cobros no se muestra ningún valor', () => {
  mocks.collections = loading()
  renderPage()
  expect(
    screen.getByRole('status', { name: /Cargando cobros de hoy/ }),
  ).toBeVisible()
  expect(screen.queryByText('USD 0.00')).not.toBeInTheDocument()
})

it('un usuario sin funciones ve un estado vacío y no consulta nada', () => {
  mocks.session = { username: 'nuevo', roles: [], permissions: [] }
  mocks.pending = loading()
  mocks.collections = loading()
  renderPage()
  expect(
    screen.getByText('Su cuenta todavía no tiene funciones asignadas.'),
  ).toBeVisible()
  expect(mocks.enabled).toEqual({ pending: false, collections: false })
  expect(screen.queryByRole('search')).not.toBeInTheDocument()
})

it('quien solo administra usuarios no consulta cobros ni cuentas', () => {
  mocks.session = { username: 'aux', roles: [], permissions: ['usuarios.ver'] }
  renderPage()
  expect(mocks.enabled).toEqual({ pending: false, collections: false })
  expect(
    screen.getByText('Su cuenta todavía no tiene funciones asignadas.'),
  ).toBeVisible()
})

// --- Aviso de la calificación artesanal --------------------------------------------------

it('el Administrador ve el aviso de la calificación con fecha y días', () => {
  asAdmin()
  mocks.pending = ok({
    items: [],
    qualification: {
      entity_id: 2,
      expires_on: '2026-11-20',
      days_left: 45,
      expired: false,
    },
  })
  renderPage()
  expect(
    screen.getByText(/La calificación artesanal vence el 20 de noviembre/),
  ).toBeVisible()
  expect(screen.getByText(/Faltan 45 días/)).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Revisar la calificación' }),
  ).toHaveAttribute('href', '/configuration?tab=facturacion&entidad=2')
})

it('una calificación vencida se anuncia como vencida y sin aviso no se muestra nada', () => {
  asAdmin()
  mocks.pending = ok({
    items: [],
    qualification: {
      entity_id: 2,
      expires_on: '2026-09-01',
      days_left: 0,
      expired: true,
    },
  })
  const view = renderPage()
  expect(screen.getByText(/La calificación artesanal venció/)).toBeVisible()
  view.unmount()

  mocks.pending = ok({ items: [], qualification: null })
  renderPage()
  expect(screen.queryByText(/calificación artesanal/)).not.toBeInTheDocument()
})
