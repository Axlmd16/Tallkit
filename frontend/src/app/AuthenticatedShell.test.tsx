import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { expect, it, vi } from 'vitest'

import type { Session } from '@/features/auth/types'
import { setViewport, tabletWidth } from '@/test-viewport'

// @ts-expect-error Node fs module used in test runner
import fs from 'node:fs'

import { AuthenticatedShell } from './AuthenticatedShell'

function useTabletViewport() {
  setViewport(tabletWidth)
}

const fullAccess: Session = {
  authenticated: true,
  username: 'admin',
  roles: ['ADMINISTRADOR'],
  permissions: [
    'clientes.ver',
    'marcas_vehiculo.ver',
    'vehiculos.ver',
    'productos.ver',
    'servicios.ver',
    'mantenimientos.ver',
    'proveedores.ver',
    'ingresos.ver',
    'inventario.ver',
    'usuarios.ver',
    'auditoria.ver',
    'operacion.ver_estado',
    'parametros.gestionar',
  ],
  must_change_password: false,
}

function renderAt(path: string, session: Session = fullAccess) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthenticatedShell onLogout={vi.fn()} session={session}>
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )
}

function CurrentPath() {
  return <output data-testid="current-path">{useLocation().pathname}</output>
}

const vendedor: Session = {
  authenticated: true,
  username: 'venta',
  roles: ['VENDEDOR'],
  permissions: [
    'clientes.ver',
    'vehiculos.ver',
    'productos.ver',
    'servicios.ver',
    'ventas.ver',
    'proformas.ver',
    'pagos_comerciales.ver',
    'inventario.ver',
    'ingresos.ver',
    'fiscal.comercial.ver',
  ],
  must_change_password: false,
}

const encargado: Session = {
  authenticated: true,
  username: 'taller',
  roles: ['ENCARGADO_TALLER'],
  permissions: [
    'mantenimientos.ver',
    'inventario.ver',
    'pagos_artesanales.ver',
  ],
  must_change_password: false,
}

const todoElEquipo: Session = {
  authenticated: true,
  username: 'hija',
  roles: ['ADMINISTRADOR', 'VENDEDOR', 'ENCARGADO_TALLER'],
  permissions: [
    ...new Set([
      ...fullAccess.permissions,
      ...vendedor.permissions,
      ...encargado.permissions,
      'fiscal.artesanal.ver',
    ]),
  ],
  must_change_password: false,
}

const cases: Array<[string, Session, boolean]> = [
  ['Administrador', fullAccess, true],
  [
    'Vendedor',
    { ...vendedor, permissions: ['ventas.ver', 'inventario.ver'] },
    false,
  ],
  ['Encargado del taller', encargado, false],
]

function mainNav() {
  return within(
    screen.getAllByRole('navigation', { name: 'Navegación principal' })[0]!,
  )
}

const hrefs = (nav: ReturnType<typeof within>) =>
  nav.getAllByRole('link').map((link: HTMLElement) => link.getAttribute('href'))

it.each(cases)(
  'derives navigation for %s only from session permissions',
  (_, session, isAdmin) => {
    render(
      <MemoryRouter>
        <AuthenticatedShell onLogout={vi.fn()} session={session}>
          <p>Contenido</p>
        </AuthenticatedShell>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Inicio' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument()
    expect(mainNav().queryByRole('link', { name: 'Ajustes' }) !== null).toBe(
      isAdmin,
    )
  },
)

it('un usuario con los tres roles ve las nueve entradas a la vez, sin grupos que expandir', () => {
  renderAt('/', todoElEquipo)

  const nav = mainNav()
  expect(nav.queryAllByRole('button')).toHaveLength(0)
  expect(hrefs(nav)).toEqual([
    '/',
    '/maintenance',
    '/sales',
    '/invoices',
    '/customers',
    '/products',
    '/services',
    '/sales/receivables',
    '/settings',
  ])
  expect(nav.getByRole('link', { name: 'Inicio' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

it('un usuario con un solo rol ve solo las entradas que sus permisos abren', () => {
  renderAt('/', vendedor)
  expect(hrefs(mainNav())).not.toContain('/maintenance')
  expect(hrefs(mainNav())).toContain('/sales')

  renderAt('/', encargado)
  expect(
    hrefs(mainNav()).filter((href: string | null) => href === '/settings'),
  ).toHaveLength(1)
})

it('shows every assigned role but does not infer navigation from role names', () => {
  render(
    <MemoryRouter>
      <AuthenticatedShell
        onLogout={vi.fn()}
        session={{
          authenticated: true,
          username: 'operador',
          roles: ['VENDEDOR', 'ENCARGADO_TALLER'],
          permissions: ['ventas.ver', 'mantenimientos.ver'],
          must_change_password: false,
        }}
      >
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  expect(
    screen.getByText('operador · Vendedor · Encargado del taller'),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('link', { name: 'Usuarios' }),
  ).not.toBeInTheDocument()
})

it('keeps logout available and prevents duplicate submissions', async () => {
  let finish!: () => void
  const onLogout = vi.fn(
    () => new Promise<void>((resolve) => (finish = resolve)),
  )
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <AuthenticatedShell onLogout={onLogout} session={cases[1]![1]}>
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  const button = screen.getByRole('button', { name: 'Cerrar sesión' })
  await user.click(button)
  await user.click(button)

  expect(onLogout).toHaveBeenCalledTimes(1)
  expect(button).toBeDisabled()
  finish()
})

it('marks the current location in the authorized navigation', () => {
  renderAt('/users')

  // Una pantalla de Ajustes mantiene resaltada la entrada «Ajustes».
  expect(mainNav().getByRole('link', { name: 'Ajustes' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

it('keeps the brand title constrained and aligns expanded navigation to the rail edge', () => {
  render(
    <MemoryRouter>
      <AuthenticatedShell onLogout={vi.fn()} session={cases[0]![1]}>
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  const navigationLink = screen.getByRole('link', { name: 'Inicio' })

  expect(navigationLink).toHaveClass('app-rail-nav-item')
  expect(screen.getByTestId('brand-logo-expanded')).toHaveTextContent('Tallkit')
  expect(screen.getByTestId('brand-logo-compact')).toHaveAttribute(
    'src',
    '/src/assets/brand/isotipo.svg',
  )
})

it('opens compact navigation and closes it after choosing a route', async () => {
  const user = userEvent.setup()
  renderAt('/', cases[0]![1])

  const opener = screen.getByRole('button', { name: 'Abrir navegación' })
  await user.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Navegación principal' })
  expect(
    within(dialog).getByRole('button', { name: 'Cerrar navegación' }),
  ).toBeEnabled()
  await user.click(within(dialog).getByRole('link', { name: 'Ajustes' }))

  expect(
    screen.queryByRole('dialog', { name: 'Navegación principal' }),
  ).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
})

it('shows Clientes navigation when session includes clientes.ver permission', () => {
  renderAt('/', { ...vendedor, permissions: ['clientes.ver'] })

  expect(mainNav().getByRole('link', { name: 'Clientes' })).toBeInTheDocument()
})

it('muestra las pestañas de Clientes y marca la pantalla actual', () => {
  renderAt('/vehicles', todoElEquipo)

  expect(mainNav().getByRole('link', { name: 'Clientes' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  const tabs = within(
    screen.getByRole('navigation', { name: 'Secciones de Clientes' }),
  )
  expect(hrefs(tabs)).toEqual(['/customers', '/vehicles'])
  expect(tabs.getByRole('link', { name: 'Vehículos' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

it('Ventas y Productos muestran sus pestañas solo con dos o más secciones permitidas', () => {
  const { unmount } = renderAt('/sales', todoElEquipo)
  expect(
    hrefs(
      within(screen.getByRole('navigation', { name: 'Secciones de Ventas' })),
    ),
  ).toEqual(['/sales', '/proformas'])
  unmount()

  const only = renderAt('/products', {
    ...vendedor,
    permissions: ['productos.ver'],
  })
  expect(
    screen.queryByRole('navigation', { name: 'Secciones de Productos' }),
  ).toBeNull()
  only.unmount()

  renderAt('/products', todoElEquipo)
  expect(
    hrefs(
      within(
        screen.getByRole('navigation', { name: 'Secciones de Productos' }),
      ),
    ),
  ).toEqual(['/products', '/purchases', '/inventory'])
})

it('Cuentas no usa pestañas del marco: los negocios se eligen en la propia pantalla', () => {
  renderAt('/sales/receivables', todoElEquipo)
  expect(
    screen.queryByRole('navigation', { name: 'Secciones de Cuentas' }),
  ).toBeNull()
  expect(
    screen.queryByRole('navigation', { name: 'Cuentas de Repuestos' }),
  ).toBeNull()
  expect(mainNav().getByRole('link', { name: 'Cuentas' })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

it('Ajustes no usa pestañas y sus pantallas hijas conservan la entrada resaltada', () => {
  renderAt('/suppliers/4', todoElEquipo)

  expect(
    screen.queryByRole('navigation', { name: 'Secciones de Ajustes' }),
  ).toBeNull()
  expect(mainNav().getByRole('link', { name: 'Ajustes' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  const trail = screen.getByRole('navigation', { name: 'Ruta' })
  expect(within(trail).getByRole('link', { name: 'Ajustes' })).toHaveAttribute(
    'href',
    '/settings',
  )
  expect(within(trail).getByRole('link', { name: 'Proveedores' })).toBeVisible()
})

it('keeps detail and secondary catalog routes under their navigation option', () => {
  renderAt('/customers/7')
  const mainNavigation = screen.getAllByRole('navigation', {
    name: 'Navegación principal',
  })[0]!
  expect(
    within(mainNavigation).getByRole('link', { name: 'Clientes' }),
  ).toHaveAttribute('aria-current', 'page')
})

it('makes parent breadcrumbs navigate and names the current nested page', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/products/7/edit']}>
      <AuthenticatedShell onLogout={vi.fn()} session={fullAccess}>
        <CurrentPath />
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  const breadcrumbs = screen.getByRole('navigation', { name: 'Ruta' })
  expect(
    within(breadcrumbs).getByRole('link', { name: 'Productos' }),
  ).toHaveAttribute('href', '/products')
  expect(within(breadcrumbs).getByText('Editar producto')).toHaveAttribute(
    'aria-current',
    'page',
  )

  await user.click(within(breadcrumbs).getByRole('link', { name: 'Productos' }))
  expect(screen.getByTestId('current-path')).toHaveTextContent('/products')
})

it.each([
  ['/purchases/new', 'Nueva entrada'],
  ['/purchases/7', 'Ficha de entrada'],
  ['/products/new', 'Nuevo producto'],
])('names %s with the right noun and gender: %s', (path, label) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthenticatedShell onLogout={vi.fn()} session={fullAccess}>
        <CurrentPath />
      </AuthenticatedShell>
    </MemoryRouter>,
  )
  const breadcrumbs = screen.getByRole('navigation', { name: 'Ruta' })
  expect(within(breadcrumbs).getByText(label)).toHaveAttribute(
    'aria-current',
    'page',
  )
})

it('omits an entry when the session has no permission for any of its sections', () => {
  renderAt('/', { ...fullAccess, permissions: ['clientes.ver'] })

  expect(mainNav().getByRole('link', { name: 'Clientes' })).toBeInTheDocument()
  expect(hrefs(mainNav())).not.toContain('/products')
})

it('en tableta muestra la misma lista plana, solo con iconos y nombre accesible', () => {
  useTabletViewport()
  renderAt('/services', todoElEquipo)

  const nav = mainNav()
  expect(nav.queryAllByRole('button')).toHaveLength(0)
  expect(nav.getByRole('link', { name: 'Servicios' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(nav.getByRole('link', { name: 'Ajustes' })).toHaveAttribute(
    'href',
    '/settings',
  )
})

it('marca la opción activa con fondo grafito elevado y la barra cobre', () => {
  renderAt('/customers')
  const active = mainNav().getByRole('link', { name: 'Clientes' })
  expect(active).toHaveAttribute('aria-current', 'page')
  expect(active.className).toMatch(/\bbg-graphite-raised\b/)
  expect(active.className).toMatch(/\btext-white\b/)
  expect(active.className).toMatch(/before:bg-primary/)
  expect(active.className).not.toMatch(/\bbg-accent-soft\b/)
})

it('muestra la ruta de migas de la pantalla actual en la barra superior', () => {
  renderAt('/sales/receivables', todoElEquipo)
  const trail = screen.getByRole('navigation', { name: 'Ruta' })
  expect(trail).toHaveTextContent('Cuentas')
  expect(trail).toHaveTextContent('Repuestos')
  expect(within(trail).getByText('Por cobrar')).toHaveAttribute(
    'aria-current',
    'page',
  )
})

it('identifica el ámbito fiscal solo en las pantallas económicas', () => {
  const sales = renderAt('/sales', {
    ...fullAccess,
    permissions: [...fullAccess.permissions, 'ventas.ver'],
  })
  expect(
    screen.getByRole('status', { name: /Negocio: Repuestos/ }),
  ).toBeInTheDocument()
  sales.unmount()
  renderAt('/users')
  expect(screen.queryByRole('status', { name: /Negocio:/ })).toBeNull()
})

it('no ofrece búsqueda global en la barra superior', () => {
  renderAt('/')
  const banner = screen.getByTestId('app-topbar')
  expect(within(banner).queryByRole('searchbox')).toBeNull()
})

it('el CSS fija barra lateral de 232 px desde 1280 px e iconos de 72 px en tableta', () => {
  const css: string = fs.readFileSync('src/shared/styles/index.css', 'utf-8')
  expect(css).toMatch(
    /@media \(min-width: 768px\)[^{]*{[\s\S]*?\.app-rail\s*{[^}]*width:\s*72px/,
  )
  expect(css).toMatch(
    /@media \(min-width: 1280px\)[^{]*{[\s\S]*?\.app-rail\s*{[^}]*width:\s*232px/,
  )
  expect(css).not.toMatch(/width:\s*80px;\s*\n\s*height: calc\(100dvh - 60px\)/)
})
