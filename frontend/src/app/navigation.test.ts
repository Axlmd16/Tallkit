import type { RouteObject } from 'react-router'
import { describe, expect, it } from 'vitest'

import { appRoutes } from './App'

import {
  findLocation,
  homeEntry,
  navigationEntries,
  settingsOptions,
  visibleEntries,
} from './navigation'

const vendedor = [
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
]
const encargado = [
  'clientes.ver',
  'vehiculos.ver',
  'servicios.ver',
  'mantenimientos.ver',
  'pagos_artesanales.ver',
  'inventario.ver',
  'fiscal.artesanal.ver',
]
const administrador = [
  ...new Set([
    ...vendedor,
    ...encargado,
    'proveedores.ver',
    'marcas_vehiculo.ver',
    'usuarios.ver',
    'auditoria.ver',
    'operacion.ver_estado',
    'parametros.gestionar',
  ]),
]

const labels = (permissions: readonly string[]) =>
  visibleEntries(new Set(permissions)).map((entry) => entry.label)

describe('entradas visibles del menú', () => {
  it('ofrece las nueve entradas a quien tiene los tres roles, con Inicio primero', () => {
    expect(homeEntry.label).toBe('Inicio')
    expect(labels(administrador)).toEqual([
      'Mantenimientos',
      'Ventas',
      'Facturas',
      'Clientes',
      'Productos',
      'Servicios',
      'Cuentas',
      'Ajustes',
    ])
  })

  it('un Vendedor ve solo lo que sus permisos abren y, en Ajustes, solo opciones de productos', () => {
    const entries = visibleEntries(new Set(vendedor))
    expect(entries.map((entry) => entry.label)).toEqual([
      'Ventas',
      'Facturas',
      'Clientes',
      'Productos',
      'Servicios',
      'Cuentas',
      'Ajustes',
    ])
    const settings = entries.find((entry) => entry.id === 'ajustes')!
    expect(settings.sections.map((section) => section.label)).toEqual([
      'Marcas de productos',
      'Categorías',
      'Unidades de medida',
    ])
  })

  it('un Encargado del taller solo ve lo suyo, con Cuentas de un solo negocio', () => {
    const entries = visibleEntries(new Set(encargado))
    expect(entries.map((entry) => entry.label)).toEqual([
      'Mantenimientos',
      'Facturas',
      'Clientes',
      'Productos',
      'Servicios',
      'Cuentas',
    ])
    expect(entries.some((entry) => entry.id === 'ajustes')).toBe(false)
    const accounts = entries.find((entry) => entry.id === 'cuentas')!
    expect(accounts.sections.map((section) => section.scope)).toEqual([
      'artesanal',
    ])
  })

  it('un usuario sin permisos de Ajustes no ve esa entrada', () => {
    expect(labels(['clientes.ver'])).toEqual(['Clientes'])
    expect(labels([])).toEqual([])
  })

  it('una entrada enlaza a su primera sección permitida', () => {
    const entries = visibleEntries(new Set(['inventario.ver']))
    const products = entries.find((entry) => entry.id === 'productos')!
    expect(products.sections.map((section) => section.label)).toEqual([
      'Inventario',
    ])
    expect(products.to).toBe('/inventory')

    const settings = visibleEntries(new Set(['usuarios.ver'])).find(
      (entry) => entry.id === 'ajustes',
    )!
    expect(settings.to).toBe('/settings')
  })

  it('Cuentas nunca muestra la pestaña de un negocio sin permiso', () => {
    const commercialOnly = visibleEntries(
      new Set(['pagos_comerciales.ver']),
    ).find((entry) => entry.id === 'cuentas')!
    expect(commercialOnly.sections.map((section) => section.scope)).toEqual([
      'commercial',
    ])
    const both = visibleEntries(
      new Set(['pagos_comerciales.ver', 'pagos_artesanales.ver']),
    ).find((entry) => entry.id === 'cuentas')!
    expect(both.sections.map((section) => section.scope)).toEqual([
      'commercial',
      'artesanal',
    ])
  })

  it('Ajustes ofrece cada opción solo con su permiso', () => {
    const settings = visibleEntries(
      new Set(['usuarios.ver', 'proveedores.ver']),
    ).find((entry) => entry.id === 'ajustes')!
    expect(settings.sections.map((section) => section.label)).toEqual([
      'Proveedores',
      'Usuarios',
    ])
  })
})

describe('ubicación de una ruta', () => {
  const entries = visibleEntries(new Set(administrador))

  it.each([
    ['/', 'inicio'],
    ['/maintenance', 'mantenimientos'],
    ['/maintenance/12', 'mantenimientos'],
    ['/maintenance/service-operations/4', 'mantenimientos'],
    ['/sales', 'ventas'],
    ['/sales/new', 'ventas'],
    ['/proformas/3/document', 'ventas'],
    ['/invoices', 'facturas'],
    ['/fiscal/preparations/9', 'facturas'],
    ['/customers/7', 'clientes'],
    ['/vehicles', 'clientes'],
    ['/products/7/edit', 'productos'],
    ['/purchases/new', 'productos'],
    ['/inventory', 'productos'],
    ['/inventory/products/3/kardex', 'productos'],
    ['/services', 'servicios'],
    ['/sales/receivables', 'cuentas'],
    ['/sales/withholdings', 'cuentas'],
    ['/maintenance/receivables', 'cuentas'],
    ['/maintenance/withholdings', 'cuentas'],
    ['/settings', 'ajustes'],
    ['/suppliers/4', 'ajustes'],
    ['/vehicle-brands', 'ajustes'],
    ['/product-brands', 'ajustes'],
    ['/product-categories', 'ajustes'],
    ['/measurement-units', 'ajustes'],
    ['/users', 'ajustes'],
    ['/audit', 'ajustes'],
    ['/technical-status', 'ajustes'],
    ['/configuration', 'ajustes'],
  ])('%s pertenece a la entrada %s', (pathname, id) => {
    expect(findLocation(entries, pathname)?.entry.id).toBe(id)
  })

  it('las cuentas por cobrar de cada negocio no se confunden con sus listas', () => {
    expect(findLocation(entries, '/sales/receivables')?.section?.scope).toBe(
      'commercial',
    )
    expect(
      findLocation(entries, '/maintenance/receivables')?.section?.scope,
    ).toBe('artesanal')
    expect(findLocation(entries, '/sales')?.section?.id).toBe('ventas')
    expect(findLocation(entries, '/maintenance')?.section?.id).toBe(
      'mantenimientos',
    )
  })

  it('una ruta sin permiso no resuelve ninguna entrada', () => {
    const only = visibleEntries(new Set(['clientes.ver']))
    expect(findLocation(only, '/users')).toBeNull()
  })
})

describe('cobertura de rutas', () => {
  it('cada opción de Ajustes y cada sección tiene una ruta única', () => {
    const routes = navigationEntries.flatMap((entry) =>
      entry.sections.map((section) => section.to),
    )
    expect(new Set(routes).size).toBe(routes.length)
    expect(settingsOptions.length).toBeGreaterThanOrEqual(9)
  })
})

describe('ninguna pantalla se pierde', () => {
  const everything = new Set(
    navigationEntries.flatMap((entry) =>
      entry.sections.flatMap((section) => [
        ...(section.permission ? [section.permission] : []),
        ...(section.anyOf ?? []),
      ]),
    ),
  )
  const entries = visibleEntries(everything)
  const paths = (routes: RouteObject[]): string[] =>
    routes.flatMap((route) => [
      ...(route.path ? [route.path] : []),
      ...paths(route.children ?? []),
    ])
  const appPaths = paths(appRoutes).filter(
    (path) => !['/login', '/change-password', '*'].includes(path),
  )

  it('toda ruta de la aplicación pertenece a una entrada del menú', () => {
    expect(appPaths.length).toBeGreaterThan(40)
    const orphans = appPaths.filter(
      (path) => !findLocation(entries, path.replace(/:\w+/g, '1')),
    )
    expect(orphans).toEqual([])
  })

  it.each([
    ['/vehicles', 'clientes'],
    ['/proformas', 'ventas'],
    ['/purchases', 'productos'],
    ['/inventory', 'productos'],
    ['/suppliers', 'ajustes'],
    ['/maintenance/receivables', 'cuentas'],
  ])('la ruta anterior %s se abre dentro de la entrada %s', (path, id) => {
    expect(findLocation(entries, path)?.entry.id).toBe(id)
  })
})
