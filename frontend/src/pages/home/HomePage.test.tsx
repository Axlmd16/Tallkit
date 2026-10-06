import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

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
  receivables: {} as Record<string, unknown>,
  collections: {} as Record<string, unknown>,
  enabled: {} as Record<string, boolean>,
}))

vi.mock('@/features/auth/hooks', () => ({
  useSession: () => ({ data: mocks.session }),
}))
vi.mock('@/features/home/hooks', () => ({
  useHomePending: (enabled: boolean) => {
    mocks.enabled.pending = enabled
    return mocks.pending
  },
  useHomeReceivables: (enabled: boolean) => {
    mocks.enabled.receivables = enabled
    return mocks.receivables
  },
  useHomeCollections: (enabled: boolean) => {
    mocks.enabled.collections = enabled
    return mocks.collections
  },
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

const week = (amount: string) =>
  [
    '2026-09-30',
    '2026-10-01',
    '2026-10-02',
    '2026-10-03',
    '2026-10-04',
    '2026-10-05',
    '2026-10-06',
  ].map((date) => ({ date, amount }))

const COMMERCIAL_PENDING = [
  { key: 'cash_sales_unpaid', scope: 'commercial', count: 3 },
  { key: 'proformas_expiring', scope: 'commercial', count: 2 },
  { key: 'withholdings_pending', scope: 'commercial', count: 2 },
  { key: 'sale_drafts', scope: 'commercial', count: 1 },
  { key: 'proforma_drafts', scope: 'commercial', count: 0 },
]
const ARTISAN_PENDING = [
  { key: 'open_orders', scope: null, count: 4 },
  { key: 'cash_services_unpaid', scope: 'artisan', count: 1 },
  { key: 'withholdings_pending', scope: 'artisan', count: 1 },
]

function asSeller() {
  mocks.session = { username: 'ana', roles: ['VENDEDOR'], permissions: SELLER }
  mocks.pending = ok({ items: COMMERCIAL_PENDING, qualification: null })
  mocks.receivables = ok({
    items: [{ scope: 'commercial', balance: '300.00', customers: 2 }],
  })
  mocks.collections = ok({
    timezone: 'America/Guayaquil',
    items: [{ scope: 'commercial', total: '500.00', days: week('71.43') }],
  })
}

function asAdmin() {
  mocks.session = {
    username: 'root',
    roles: ['ADMINISTRADOR'],
    permissions: ADMIN,
  }
  mocks.pending = ok({
    items: [...ARTISAN_PENDING, ...COMMERCIAL_PENDING],
    qualification: null,
  })
  mocks.receivables = ok({
    items: [
      { scope: 'commercial', balance: '300.00', customers: 2 },
      { scope: 'artisan', balance: '120.00', customers: 1 },
    ],
  })
  mocks.collections = ok({
    timezone: 'America/Guayaquil',
    items: [
      { scope: 'commercial', total: '500.00', days: week('71.43') },
      { scope: 'artisan', total: '200.00', days: week('28.57') },
    ],
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mocks.enabled = {}
  asSeller()
})

// --- Marco de la página ------------------------------------------------------------------

it('conserva el título, identifica la sesión y no repite la navegación', () => {
  asAdmin()
  renderPage()
  expect(screen.getByRole('heading', { name: 'Inicio' })).toBeVisible()
  expect(screen.getByText('Sesión de root · Administrador.')).toBeVisible()
  for (const area of ['Clientes y vehículos', 'Catálogos', 'Usuarios']) {
    expect(screen.queryByRole('link', { name: area })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: area })).not.toBeInTheDocument()
  }
})

// --- Acciones rápidas --------------------------------------------------------------------

it('un Vendedor ve sus accesos y ninguno del taller', () => {
  renderPage()
  const actions = screen.getByRole('navigation', { name: 'Acciones rápidas' })
  expect(
    within(actions)
      .getAllByRole('link')
      .map((link) => [link.textContent, link.getAttribute('href')]),
  ).toEqual([
    ['Nueva venta', '/sales/new'],
    ['Nueva proforma', '/proformas/new'],
    ['Registrar entrada', '/purchases/new'],
    ['Cobrar repuestos', '/sales/receivables'],
  ])
  expect(
    screen.queryByRole('link', { name: 'Nuevo mantenimiento' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: 'Cobrar servicios' }),
  ).not.toBeInTheDocument()
})

it('quien cobra en las dos entidades tiene un acceso por entidad', () => {
  asAdmin()
  renderPage()
  const actions = screen.getByRole('navigation', { name: 'Acciones rápidas' })
  expect(
    within(actions).getByRole('link', { name: 'Cobrar repuestos' }),
  ).toHaveAttribute('href', '/sales/receivables')
  expect(
    within(actions).getByRole('link', { name: 'Cobrar servicios' }),
  ).toHaveAttribute('href', '/maintenance/receivables')
})

it('las acciones son enlaces secundarios con objetivo táctil, sin relleno de acción principal', () => {
  renderPage()
  const actions = screen.getByRole('navigation', { name: 'Acciones rápidas' })
  for (const link of within(actions).getAllByRole('link')) {
    expect(link.className).toContain('min-h-11')
    expect(link.className).not.toContain('bg-primary')
  }
})

it('las acciones siguen disponibles aunque fallen las consultas del resumen', () => {
  mocks.pending = failed()
  mocks.receivables = failed()
  mocks.collections = failed()
  renderPage()
  expect(screen.getByRole('link', { name: 'Nueva venta' })).toBeVisible()
})

// --- Pendientes --------------------------------------------------------------------------

it('cada pendiente muestra su conteo, su ámbito y conduce a su lista filtrada', () => {
  asAdmin()
  renderPage()
  const block = screen.getByRole('region', { name: 'Pendientes' })
  const link = (name: string) => within(block).getByRole('link', { name })
  expect(link('4 Mantenimientos abiertos')).toHaveAttribute(
    'href',
    '/maintenance?state=OPEN',
  )
  expect(link('3 Ventas de contado sin cobrar, RUC comercial')).toHaveAttribute(
    'href',
    '/sales/receivables?condition=CONTADO&only_debt=true',
  )
  expect(
    link('1 Servicios de contado sin cobrar, RUC artesanal'),
  ).toHaveAttribute('href', '/maintenance/receivables?condition=CONTADO')
  expect(link('2 Proformas por vencer, RUC comercial')).toHaveAttribute(
    'href',
    '/proformas?state=VALID&expires_within_days=1',
  )
  expect(link('1 Ventas en borrador, RUC comercial')).toHaveAttribute(
    'href',
    '/sales?state=DRAFT',
  )
  expect(link('0 Proformas en borrador, RUC comercial')).toHaveAttribute(
    'href',
    '/proformas?state=DRAFT',
  )
})

it('las retenciones se muestran separadas por entidad, sin total conjunto', () => {
  asAdmin()
  renderPage()
  const block = screen.getByRole('region', { name: 'Pendientes' })
  expect(
    within(block).getByRole('link', {
      name: '2 Retenciones por completar, RUC comercial',
    }),
  ).toHaveAttribute('href', '/sales/withholdings')
  expect(
    within(block).getByRole('link', {
      name: '1 Retenciones por completar, RUC artesanal',
    }),
  ).toHaveAttribute('href', '/maintenance/withholdings')
  expect(block).not.toHaveTextContent(/3 Retenciones/)
})

it('sin pendientes, cada indicador queda en cero y el bloque lo dice con texto', () => {
  mocks.pending = ok({
    items: COMMERCIAL_PENDING.map((item) => ({ ...item, count: 0 })),
    qualification: null,
  })
  renderPage()
  const block = screen.getByRole('region', { name: 'Pendientes' })
  expect(within(block).getByText('Todo al día')).toBeVisible()
  expect(within(block).getAllByRole('link')).toHaveLength(5)
  for (const value of within(block).getAllByText('0')) {
    expect(value).toHaveAttribute('data-zero', 'true')
  }
})

it('con pendientes no afirma que todo está al día', () => {
  renderPage()
  expect(screen.queryByText('Todo al día')).not.toBeInTheDocument()
})

it('el Administrador ve el aviso de la calificación artesanal con fecha y días', () => {
  asAdmin()
  mocks.pending = ok({
    items: ARTISAN_PENDING,
    qualification: {
      entity_id: 2,
      expires_on: '2026-11-20',
      days_left: 45,
      expired: false,
    },
  })
  renderPage()
  const block = screen.getByRole('region', { name: 'Pendientes' })
  expect(block).toHaveTextContent(
    'La calificación artesanal vence el 20 de noviembre de 2026',
  )
  expect(block).toHaveTextContent('Faltan 45 días')
  expect(
    within(block).getByRole('link', { name: 'Revisar la calificación' }),
  ).toHaveAttribute('href', '/configuration?tab=facturacion&entidad=2')
  expect(screen.queryByText('Todo al día')).not.toBeInTheDocument()
})

it('una calificación vencida se anuncia como vencida', () => {
  asAdmin()
  mocks.pending = ok({
    items: [],
    qualification: {
      entity_id: 2,
      expires_on: '2026-09-25',
      days_left: -11,
      expired: true,
    },
  })
  renderPage()
  expect(
    screen.getByText(
      'La calificación artesanal venció el 25 de septiembre de 2026',
    ),
  ).toBeVisible()
})

it('sin aviso de calificación no se muestra nada sobre ella', () => {
  renderPage()
  expect(screen.queryByText(/calificación artesanal/i)).not.toBeInTheDocument()
})

// --- Por cobrar --------------------------------------------------------------------------

it('muestra el saldo y los clientes por entidad, sin sumarlos', () => {
  asAdmin()
  renderPage()
  const block = screen.getByRole('region', { name: 'Por cobrar' })
  expect(
    within(block).getByRole('link', {
      name: 'USD 300.00 Repuestos por cobrar, RUC comercial, 2 clientes',
    }),
  ).toHaveAttribute('href', '/sales/receivables')
  expect(
    within(block).getByRole('link', {
      name: 'USD 120.00 Servicios por cobrar, RUC artesanal, 1 cliente',
    }),
  ).toHaveAttribute('href', '/maintenance/receivables')
  expect(document.body).not.toHaveTextContent('420.00')
})

it('sin deuda muestra cero sin énfasis de advertencia', () => {
  mocks.receivables = ok({
    items: [{ scope: 'commercial', balance: '0.00', customers: 0 }],
  })
  renderPage()
  const block = screen.getByRole('region', { name: 'Por cobrar' })
  expect(
    within(block).getByRole('link', {
      name: 'USD 0.00 Repuestos por cobrar, RUC comercial, Sin clientes con deuda',
    }),
  ).toBeVisible()
  expect(block.querySelector('[data-zero="true"]')).not.toBeNull()
})

// --- Cobros recientes --------------------------------------------------------------------

it('muestra un gráfico por entidad con su total y sin total conjunto', () => {
  asAdmin()
  renderPage()
  const block = screen.getByRole('region', { name: 'Cobrado en 7 días' })
  const commercial = within(block).getByRole('group', {
    name: 'Cobrado en 7 días, RUC comercial',
  })
  const artisan = within(block).getByRole('group', {
    name: 'Cobrado en 7 días, RUC artesanal',
  })
  expect(commercial).toHaveTextContent('USD 500.00')
  expect(artisan).toHaveTextContent('USD 200.00')
  expect(document.body).not.toHaveTextContent('700.00')
})

it('cada día se puede leer como texto sin ver el gráfico', () => {
  renderPage()
  expect(
    screen.getByRole('img', { name: 'martes 6 de octubre: USD 71.43' }),
  ).toBeInTheDocument()
  expect(screen.getAllByRole('img')).toHaveLength(7)
})

// --- Estados por bloque ------------------------------------------------------------------

it('mientras carga, cada bloque muestra marcadores de posición y ningún valor', () => {
  mocks.pending = loading()
  mocks.receivables = loading()
  mocks.collections = loading()
  renderPage()
  expect(screen.getAllByRole('status', { name: /Cargando/ })).toHaveLength(3)
  expect(screen.queryByText('USD 0.00')).not.toBeInTheDocument()
})

it('si falla un bloque, solo ese muestra el error y los demás siguen operables', async () => {
  const user = userEvent.setup()
  const broken = failed()
  mocks.collections = broken
  renderPage()
  const block = screen.getByRole('region', { name: 'Cobrado en 7 días' })
  expect(within(block).getByRole('alert')).toHaveTextContent(
    'No se pudieron cargar los cobros',
  )
  await user.click(within(block).getByRole('button', { name: 'Reintentar' }))
  expect(broken.refetch).toHaveBeenCalledTimes(1)
  expect(
    within(screen.getByRole('region', { name: 'Pendientes' })).getAllByRole(
      'link',
    ),
  ).toHaveLength(5)
  expect(
    screen.getByRole('link', {
      name: 'USD 300.00 Repuestos por cobrar, RUC comercial, 2 clientes',
    }),
  ).toBeVisible()
})

it('un dato que no pudo obtenerse no se muestra como cero', () => {
  mocks.receivables = failed()
  renderPage()
  const block = screen.getByRole('region', { name: 'Por cobrar' })
  expect(block).not.toHaveTextContent('USD 0.00')
  expect(within(block).getByRole('alert')).toBeVisible()
})

it('un bloque sin indicadores para la persona no se muestra', () => {
  mocks.receivables = ok({ items: [] })
  mocks.collections = ok({ timezone: 'America/Guayaquil', items: [] })
  renderPage()
  expect(
    screen.queryByRole('region', { name: 'Por cobrar' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('region', { name: 'Cobrado en 7 días' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Pendientes' })).toBeVisible()
})

// --- Qué se consulta según la sesión -----------------------------------------------------

it('un Encargado del taller no consulta ni ve lo comercial', () => {
  mocks.session = {
    username: 'luis',
    roles: ['ENCARGADO_TALLER'],
    permissions: MANAGER,
  }
  mocks.pending = ok({ items: ARTISAN_PENDING, qualification: null })
  mocks.receivables = ok({
    items: [{ scope: 'artisan', balance: '120.00', customers: 1 }],
  })
  mocks.collections = ok({
    timezone: 'America/Guayaquil',
    items: [{ scope: 'artisan', total: '200.00', days: week('28.57') }],
  })
  renderPage()
  expect(
    screen.getByText('Sesión de luis · Encargado del taller.'),
  ).toBeVisible()
  expect(screen.queryByText('Comercial')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: 'Nueva venta' }),
  ).not.toBeInTheDocument()
  expect(mocks.enabled).toEqual({
    pending: true,
    receivables: true,
    collections: true,
  })
})

it('un usuario sin funciones ve un estado vacío y no consulta el resumen', () => {
  mocks.session = { username: 'nuevo', roles: [], permissions: [] }
  mocks.pending = loading()
  mocks.receivables = loading()
  mocks.collections = loading()
  renderPage()
  expect(
    screen.getByText('Su cuenta todavía no tiene funciones asignadas.'),
  ).toBeVisible()
  expect(mocks.enabled).toEqual({
    pending: false,
    receivables: false,
    collections: false,
  })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('navigation', { name: 'Acciones rápidas' }),
  ).not.toBeInTheDocument()
})

it('quien solo administra usuarios no consulta saldos ni cobros', () => {
  mocks.session = {
    username: 'aux',
    roles: [],
    permissions: ['usuarios.ver', 'proformas.ver'],
  }
  mocks.pending = ok({
    items: [{ key: 'proforma_drafts', scope: 'commercial', count: 0 }],
    qualification: null,
  })
  renderPage()
  expect(mocks.enabled).toEqual({
    pending: true,
    receivables: false,
    collections: false,
  })
  expect(screen.getByRole('region', { name: 'Pendientes' })).toBeVisible()
})
