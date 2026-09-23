import {
  AddressBook,
  BookOpen,
  Car,
  ClipboardText,
  Coins,
  DownloadSimple,
  House,
  ListChecks,
  Package,
  Pulse,
  Receipt,
  ShieldCheck,
  ShoppingCartSimple,
  SlidersHorizontal,
  Stack,
  Tag,
  Toolbox,
  Truck,
  Users,
  UsersThree,
  Wrench,
  type Icon,
} from '@phosphor-icons/react'

export interface NavItem {
  icon: Icon
  label: string
  to: string
  permission: string | null
  /** Rutas adicionales que pertenecen a esta opción (además de `to` y sus detalles). */
  alsoMatches?: readonly string[]
  /** Rutas que, aunque comparten prefijo, pertenecen a otra opción. */
  excludes?: readonly string[]
}

export interface NavGroup {
  id: string
  icon: Icon
  label: string
  items: readonly NavItem[]
}

export const homeItem: NavItem = {
  icon: House,
  label: 'Inicio',
  to: '/',
  permission: null,
}

/**
 * Agrupación por intención de trabajo: relación con el cliente, catálogos,
 * operación del taller, abastecimiento y administración no se mezclan.
 * La interfaz solo organiza; la autorización real pertenece al backend.
 */
export const navigationGroups: readonly NavGroup[] = [
  {
    id: 'clientes-vehiculos',
    icon: UsersThree,
    label: 'Clientes y vehículos',
    items: [
      {
        icon: AddressBook,
        label: 'Clientes',
        to: '/customers',
        permission: 'clientes.ver',
      },
      {
        icon: Car,
        label: 'Vehículos',
        to: '/vehicles',
        permission: 'vehiculos.ver',
      },
      {
        icon: Tag,
        label: 'Marcas de vehículos',
        to: '/vehicle-brands',
        permission: 'marcas_vehiculo.ver',
      },
    ],
  },
  {
    id: 'catalogos',
    icon: BookOpen,
    label: 'Catálogos',
    items: [
      {
        icon: Package,
        label: 'Productos',
        to: '/products',
        permission: 'productos.ver',
        alsoMatches: [
          '/product-categories',
          '/measurement-units',
          '/product-brands',
        ],
      },
      {
        icon: Toolbox,
        label: 'Servicios',
        to: '/services',
        permission: 'servicios.ver',
      },
    ],
  },
  {
    id: 'operacion-taller',
    icon: Wrench,
    label: 'Operación del taller',
    items: [
      {
        icon: ListChecks,
        label: 'Mantenimientos',
        to: '/maintenance',
        permission: 'mantenimientos.ver',
      },
    ],
  },
  {
    id: 'ventas-cobros',
    icon: Receipt,
    label: 'Ventas y cobros',
    items: [
      {
        icon: Receipt,
        label: 'Ventas',
        to: '/sales',
        permission: 'ventas.ver',
        excludes: ['/sales/receivables'],
      },
      {
        icon: Coins,
        label: 'Cuentas por cobrar',
        to: '/sales/receivables',
        permission: 'pagos_comerciales.ver',
      },
    ],
  },
  {
    id: 'compras-inventario',
    icon: ShoppingCartSimple,
    label: 'Compras e inventario',
    items: [
      {
        icon: Truck,
        label: 'Proveedores',
        to: '/suppliers',
        permission: 'proveedores.ver',
      },
      {
        icon: DownloadSimple,
        label: 'Ingresos',
        to: '/purchases',
        permission: 'ingresos.ver',
      },
      {
        icon: Stack,
        label: 'Inventario',
        to: '/inventory',
        permission: 'inventario.ver',
      },
    ],
  },
  {
    id: 'administracion-control',
    icon: ShieldCheck,
    label: 'Administración y control',
    items: [
      {
        icon: Users,
        label: 'Usuarios',
        to: '/users',
        permission: 'usuarios.ver',
      },
      {
        icon: ClipboardText,
        label: 'Auditoría',
        to: '/audit',
        permission: 'auditoria.ver',
      },
      {
        icon: Pulse,
        label: 'Estado técnico',
        to: '/technical-status',
        permission: 'operacion.ver_estado',
      },
      {
        icon: SlidersHorizontal,
        label: 'Configuración',
        to: '/configuration',
        permission: 'parametros.gestionar',
      },
    ],
  },
]

export function isItemActive(item: NavItem, pathname: string) {
  if (item.to === '/') return pathname === '/'
  const excluded = (item.excludes ?? []).some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  )
  if (excluded) return false
  return [item.to, ...(item.alsoMatches ?? [])].some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  )
}

/** Grupos con al menos una opción permitida; los vacíos no se muestran. */
export function visibleGroups(permissions: ReadonlySet<string>): NavGroup[] {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || permissions.has(item.permission),
      ),
    }))
    .filter((group) => group.items.length > 0)
}

export function findActiveGroupId(
  groups: readonly NavGroup[],
  pathname: string,
): string | null {
  return (
    groups.find((group) =>
      group.items.some((item) => isItemActive(item, pathname)),
    )?.id ?? null
  )
}

/** Ámbito fiscal de las áreas con operaciones económicas; el resto es compartido. */
export const groupScopes: Readonly<Record<string, 'commercial' | 'artesanal'>> =
  {
    'ventas-cobros': 'commercial',
    'compras-inventario': 'commercial',
    'operacion-taller': 'artesanal',
  }

/** Grupo y opción que corresponden a la ruta, para la ruta de migas y el ámbito fiscal. */
export function findLocation(
  groups: readonly NavGroup[],
  pathname: string,
): { group: NavGroup | null; item: NavItem } | null {
  if (isItemActive(homeItem, pathname)) return { group: null, item: homeItem }
  for (const group of groups) {
    const item = group.items.find((candidate) =>
      isItemActive(candidate, pathname),
    )
    if (item) return { group, item }
  }
  return null
}
