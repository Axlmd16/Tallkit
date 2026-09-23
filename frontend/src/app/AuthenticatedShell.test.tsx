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

const cases: Array<[string, Session, boolean]> = [
  [
    'Administrador',
    {
      authenticated: true,
      username: 'admin',
      roles: ['ADMINISTRADOR'],
      permissions: ['usuarios.ver', 'auditoria.ver', 'operacion.ver_estado'],
      must_change_password: false,
    },
    true,
  ],
  [
    'Vendedor',
    {
      authenticated: true,
      username: 'venta',
      roles: ['VENDEDOR'],
      permissions: ['ventas.ver', 'inventario.ver'],
      must_change_password: false,
    },
    false,
  ],
  [
    'Encargado del taller',
    {
      authenticated: true,
      username: 'taller',
      roles: ['ENCARGADO_TALLER'],
      permissions: ['mantenimientos.ver', 'inventario.ver'],
      must_change_password: false,
    },
    false,
  ],
]

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
    const adminGroup = screen.queryByRole('button', {
      name: 'Administración y control',
    })
    expect(adminGroup !== null).toBe(isAdmin)
  },
)

it('lists administration options only inside their group for authorized sessions', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <AuthenticatedShell onLogout={vi.fn()} session={cases[0]![1]}>
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  await user.click(
    screen.getByRole('button', { name: 'Administración y control' }),
  )

  expect(screen.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Auditoría' })).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Estado técnico' }),
  ).toBeInTheDocument()
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
  render(
    <MemoryRouter initialEntries={['/users']}>
      <AuthenticatedShell onLogout={vi.fn()} session={cases[0]![1]}>
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute(
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
  render(
    <MemoryRouter>
      <AuthenticatedShell onLogout={vi.fn()} session={cases[0]![1]}>
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  const opener = screen.getByRole('button', { name: 'Abrir navegación' })
  await user.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Navegación principal' })
  expect(
    within(dialog).getByRole('button', { name: 'Cerrar navegación' }),
  ).toBeEnabled()
  await user.click(
    within(dialog).getByRole('button', { name: 'Administración y control' }),
  )
  await user.click(within(dialog).getByRole('link', { name: 'Auditoría' }))

  expect(
    screen.queryByRole('dialog', { name: 'Navegación principal' }),
  ).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
})

it('shows Clientes navigation when session includes clientes.ver permission', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <AuthenticatedShell
        onLogout={vi.fn()}
        session={{
          authenticated: true,
          username: 'vendedor',
          roles: ['VENDEDOR'],
          permissions: ['clientes.ver'],
          must_change_password: false,
        }}
      >
        <p>Contenido</p>
      </AuthenticatedShell>
    </MemoryRouter>,
  )

  await user.click(screen.getByRole('button', { name: 'Clientes y vehículos' }))

  expect(screen.getByRole('link', { name: 'Clientes' })).toBeInTheDocument()
})

it('shows Inicio as a standalone link above the collapsible groups', () => {
  renderAt('/')

  const nav = screen.getAllByRole('navigation', {
    name: 'Navegación principal',
  })[0]!
  expect(within(nav).getByRole('link', { name: 'Inicio' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  const groups = [
    'Clientes y vehículos',
    'Catálogos',
    'Operación del taller',
    'Compras e inventario',
    'Administración y control',
  ]
  for (const name of groups) {
    expect(within(nav).getByRole('button', { name })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  }
  expect(
    within(nav).queryByRole('link', { name: 'Clientes' }),
  ).not.toBeInTheDocument()
})

it('expands and collapses a group with its button', async () => {
  const user = userEvent.setup()
  renderAt('/')

  const group = screen.getByRole('button', { name: 'Catálogos' })
  await user.click(group)
  expect(group).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('link', { name: 'Productos' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Servicios' })).toBeInTheDocument()

  await user.click(group)
  expect(group).toHaveAttribute('aria-expanded', 'false')
  expect(
    screen.queryByRole('link', { name: 'Productos' }),
  ).not.toBeInTheDocument()
})

it('opens the group of the current route and highlights the option', () => {
  renderAt('/vehicles')

  expect(
    screen.getByRole('button', { name: 'Clientes y vehículos' }),
  ).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('link', { name: 'Vehículos' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(screen.getByRole('link', { name: 'Clientes' })).not.toHaveAttribute(
    'aria-current',
  )
  expect(screen.getByRole('button', { name: 'Catálogos' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
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
    within(breadcrumbs).getByRole('link', { name: 'Catálogos' }),
  ).toHaveAttribute('href', '/products')
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

it('keeps the active option visible when its group is collapsed', async () => {
  const user = userEvent.setup()
  renderAt('/purchases')

  const group = screen.getByRole('button', { name: 'Compras e inventario' })
  expect(screen.getByRole('link', { name: 'Proveedores' })).toBeInTheDocument()

  await user.click(group)

  expect(group).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('link', { name: 'Ingresos' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(
    screen.queryByRole('link', { name: 'Proveedores' }),
  ).not.toBeInTheDocument()
})

it('omits a group when the session has no permission for any of its options', () => {
  renderAt('/', {
    ...fullAccess,
    permissions: ['clientes.ver'],
  })

  expect(
    screen.getByRole('button', { name: 'Clientes y vehículos' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Catálogos' }),
  ).not.toBeInTheDocument()
})

it('uses group icons with a popover on compact viewports', async () => {
  useTabletViewport()
  const user = userEvent.setup()
  renderAt('/purchases')

  const group = screen.getByRole('button', { name: 'Compras e inventario' })
  expect(group).toHaveAttribute('aria-haspopup', 'true')
  expect(group).toHaveAttribute('aria-expanded', 'false')
  expect(
    screen.queryByRole('link', { name: 'Proveedores' }),
  ).not.toBeInTheDocument()

  await user.click(group)
  const popover = screen.getByRole('group', { name: 'Compras e inventario' })
  expect(group).toHaveAttribute('aria-expanded', 'true')
  expect(
    within(popover).getByRole('link', { name: 'Ingresos' }),
  ).toHaveAttribute('aria-current', 'page')

  await user.keyboard('{Escape}')
  expect(
    screen.queryByRole('group', { name: 'Compras e inventario' }),
  ).not.toBeInTheDocument()
  expect(group).toHaveFocus()
})

it('marks the active group in the compact rail', () => {
  useTabletViewport()
  renderAt('/services')

  expect(screen.getByRole('button', { name: 'Catálogos' })).toHaveAttribute(
    'data-active',
    'true',
  )
  expect(
    screen.getByRole('button', { name: 'Operación del taller' }),
  ).not.toHaveAttribute('data-active')
})

it('marca la opción activa con el acento de selección, no con la acción principal', () => {
  renderAt('/customers')
  const active = screen.getByRole('link', { name: 'Clientes' })
  expect(active).toHaveAttribute('aria-current', 'page')
  expect(active.className).toMatch(/bg-accent-soft/)
  expect(active.className).toMatch(/text-accent-strong/)
  expect(active.className).not.toMatch(/\bbg-primary-soft\b|\btext-primary\b/)
})

it('muestra la ruta de migas de la pantalla actual en la barra superior', () => {
  renderAt('/sales/receivables', {
    ...fullAccess,
    permissions: [
      ...fullAccess.permissions,
      'ventas.ver',
      'pagos_comerciales.ver',
    ],
  })
  const trail = screen.getByRole('navigation', { name: 'Ruta' })
  expect(trail).toHaveTextContent('Ventas y cobros')
  expect(trail).toHaveTextContent('Cuentas por cobrar')
  expect(within(trail).getByText('Cuentas por cobrar')).toHaveAttribute(
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
    screen.getByRole('status', { name: /Ámbito fiscal: RUC comercial/ }),
  ).toBeInTheDocument()
  sales.unmount()
  renderAt('/users')
  expect(screen.queryByRole('status', { name: /Ámbito fiscal/ })).toBeNull()
})

it('no ofrece búsqueda global en la barra superior', () => {
  renderAt('/')
  const banner = screen.getByTestId('app-topbar')
  expect(within(banner).queryByRole('searchbox')).toBeNull()
})

it('el CSS fija barra lateral de 240 px desde 1280 px e iconos de 72 px en tableta', () => {
  const css: string = fs.readFileSync('src/shared/styles/index.css', 'utf-8')
  expect(css).toMatch(
    /@media \(min-width: 768px\)[^{]*{[\s\S]*?\.app-rail\s*{[^}]*width:\s*72px/,
  )
  expect(css).toMatch(
    /@media \(min-width: 1280px\)[^{]*{[\s\S]*?\.app-rail\s*{[^}]*width:\s*240px/,
  )
  expect(css).not.toMatch(/width:\s*80px;\s*\n\s*height: calc\(100dvh - 60px\)/)
})
