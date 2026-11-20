import {
  AddressBook,
  ClipboardText,
  Coins,
  FileText,
  Gear,
  House,
  ListChecks,
  Package,
  Pulse,
  Receipt,
  SlidersHorizontal,
  Tag,
  Toolbox,
  Truck,
  Users,
  type Icon,
} from '@phosphor-icons/react'

export type NavScope = 'commercial' | 'artesanal'

/** Segundo nivel de pestañas dentro de una sección («Por cobrar», «Retenciones»). */
export interface NavSubsection {
  label: string
  to: string
}

/** Pantalla que vive dentro de una entrada del menú: una pestaña o una opción de «Ajustes». */
export interface NavSection {
  id: string
  label: string
  to: string
  /** Permiso que la abre; con `anyOf` basta uno de la lista. Sin ninguno, siempre se muestra. */
  permission?: string
  anyOf?: readonly string[]
  /** Rutas adicionales que pertenecen a esta sección (además de `to` y sus detalles). */
  alsoMatches?: readonly string[]
  /** Rutas que, aunque comparten prefijo, pertenecen a otra sección. */
  excludes?: readonly string[]
  /** Negocio al que pertenece la pantalla; las compartidas no llevan insignia. */
  scope?: NavScope
  /** La etiqueta es el nombre del negocio (pestañas de «Cuentas»). */
  businessTab?: boolean
  subsections?: readonly NavSubsection[]
  /** Solo para las opciones de «Ajustes». */
  icon?: Icon
  description?: string
}

export interface NavEntry {
  id: string
  icon: Icon
  label: string
  /** Destino de la entrada; por omisión, la primera sección permitida. */
  to?: string
  /**
   * `auto`: pestañas desde dos secciones permitidas. `always`: aun con una sola, porque cada
   * pestaña es un negocio. `never`: las secciones son opciones de una página de entrada.
   */
  tabs?: 'auto' | 'always' | 'never'
  sections: readonly NavSection[]
}

export interface VisibleNavEntry extends NavEntry {
  to: string
}

export const homeEntry: VisibleNavEntry = {
  id: 'inicio',
  icon: House,
  label: 'Inicio',
  to: '/',
  sections: [],
}

/**
 * Opciones de uso poco frecuente: se alcanzan desde la página «Ajustes» y no tienen entrada
 * propia en el menú.
 */
const settingsSections: readonly NavSection[] = [
  {
    id: 'proveedores',
    label: 'Proveedores',
    to: '/suppliers',
    permission: 'proveedores.ver',
    icon: Truck,
    description: 'Quién le vende los repuestos y cómo contactarlo.',
  },
  {
    id: 'marcas-vehiculo',
    label: 'Marcas de vehículos',
    to: '/vehicle-brands',
    permission: 'marcas_vehiculo.ver',
    icon: Tag,
    description: 'Las marcas de autos que se usan al registrar un vehículo.',
  },
  {
    id: 'marcas-producto',
    label: 'Marcas de productos',
    to: '/product-brands',
    permission: 'productos.ver',
    icon: Tag,
    description: 'Las marcas de los repuestos que vende.',
  },
  {
    id: 'categorias',
    label: 'Categorías',
    to: '/product-categories',
    permission: 'productos.ver',
    icon: Package,
    description: 'Cómo se agrupan los productos para encontrarlos rápido.',
  },
  {
    id: 'unidades',
    label: 'Unidades de medida',
    to: '/measurement-units',
    permission: 'productos.ver',
    icon: ListChecks,
    description: 'Unidad, litro, juego u otra forma de vender un producto.',
  },
  {
    id: 'usuarios',
    label: 'Usuarios',
    to: '/users',
    permission: 'usuarios.ver',
    icon: Users,
    description: 'Quién puede entrar al sistema y qué puede hacer.',
  },
  {
    id: 'auditoria',
    label: 'Auditoría',
    to: '/audit',
    permission: 'auditoria.ver',
    icon: ClipboardText,
    description: 'Registro de quién hizo qué y cuándo.',
  },
  {
    id: 'estado-tecnico',
    label: 'Estado técnico',
    to: '/technical-status',
    permission: 'operacion.ver_estado',
    icon: Pulse,
    description: 'Comprueba que el sistema y sus servicios estén funcionando.',
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    to: '/configuration',
    permission: 'parametros.gestionar',
    icon: SlidersHorizontal,
    description: 'Datos de los negocios, impuestos, series y facturación.',
  },
]

export const settingsOptions = settingsSections

/**
 * Nueve entradas sin grupos plegables: Inicio y las ocho siguientes. Una entrada se muestra
 * solo si alguna de sus secciones está permitida; la autorización real pertenece al backend.
 */
export const navigationEntries: readonly NavEntry[] = [
  {
    id: 'mantenimientos',
    icon: ListChecks,
    label: 'Mantenimientos',
    sections: [
      {
        id: 'mantenimientos',
        label: 'Mantenimientos',
        to: '/maintenance',
        permission: 'mantenimientos.ver',
        excludes: ['/maintenance/receivables', '/maintenance/withholdings'],
        scope: 'artesanal',
      },
    ],
  },
  {
    id: 'ventas',
    icon: Receipt,
    label: 'Ventas',
    sections: [
      {
        id: 'ventas',
        label: 'Ventas',
        to: '/sales',
        permission: 'ventas.ver',
        excludes: ['/sales/receivables', '/sales/withholdings'],
        scope: 'commercial',
      },
      {
        id: 'proformas',
        label: 'Proformas',
        to: '/proformas',
        permission: 'proformas.ver',
        scope: 'commercial',
      },
    ],
  },
  {
    id: 'facturas',
    icon: FileText,
    label: 'Facturas',
    sections: [
      {
        id: 'facturas',
        label: 'Facturas',
        to: '/invoices',
        anyOf: ['fiscal.comercial.ver', 'fiscal.artesanal.ver'],
        alsoMatches: ['/fiscal'],
      },
    ],
  },
  {
    id: 'clientes',
    icon: AddressBook,
    label: 'Clientes',
    sections: [
      {
        id: 'clientes',
        label: 'Clientes',
        to: '/customers',
        permission: 'clientes.ver',
      },
      {
        id: 'vehiculos',
        label: 'Vehículos',
        to: '/vehicles',
        permission: 'vehiculos.ver',
      },
    ],
  },
  {
    id: 'productos',
    icon: Package,
    label: 'Productos',
    sections: [
      {
        id: 'productos',
        label: 'Productos',
        to: '/products',
        permission: 'productos.ver',
      },
      {
        id: 'entradas',
        label: 'Entradas',
        to: '/purchases',
        permission: 'ingresos.ver',
        scope: 'commercial',
      },
      {
        id: 'inventario',
        label: 'Inventario',
        to: '/inventory',
        permission: 'inventario.ver',
        scope: 'commercial',
      },
    ],
  },
  {
    id: 'servicios',
    icon: Toolbox,
    label: 'Servicios',
    sections: [
      {
        id: 'servicios',
        label: 'Servicios',
        to: '/services',
        permission: 'servicios.ver',
      },
    ],
  },
  {
    id: 'cuentas',
    icon: Coins,
    label: 'Cuentas',
    tabs: 'never',
    sections: [
      {
        id: 'cuentas-comercial',
        label: 'Repuestos',
        to: '/sales/receivables',
        permission: 'pagos_comerciales.ver',
        alsoMatches: ['/sales/withholdings'],
        scope: 'commercial',
        businessTab: true,
        subsections: [
          { label: 'Por cobrar', to: '/sales/receivables' },
          { label: 'Retenciones', to: '/sales/withholdings' },
        ],
      },
      {
        id: 'cuentas-artesanal',
        label: 'Servicios',
        to: '/maintenance/receivables',
        permission: 'pagos_artesanales.ver',
        alsoMatches: ['/maintenance/withholdings'],
        scope: 'artesanal',
        businessTab: true,
        subsections: [
          { label: 'Por cobrar', to: '/maintenance/receivables' },
          { label: 'Retenciones', to: '/maintenance/withholdings' },
        ],
      },
    ],
  },
  {
    id: 'ajustes',
    icon: Gear,
    label: 'Ajustes',
    to: '/settings',
    tabs: 'never',
    sections: settingsSections,
  },
]

export function isSectionAllowed(
  section: NavSection,
  permissions: ReadonlySet<string>,
) {
  if (section.anyOf) return section.anyOf.some((p) => permissions.has(p))
  return !section.permission || permissions.has(section.permission)
}

const covers = (base: string, pathname: string) =>
  pathname === base || pathname.startsWith(`${base}/`)

export function isSectionActive(section: NavSection, pathname: string) {
  if ((section.excludes ?? []).some((base) => covers(base, pathname)))
    return false
  return [section.to, ...(section.alsoMatches ?? [])].some((base) =>
    covers(base, pathname),
  )
}

/** Entradas con al menos una sección permitida; las demás no se muestran. */
export function visibleEntries(
  permissions: ReadonlySet<string>,
): VisibleNavEntry[] {
  const visible: VisibleNavEntry[] = []
  for (const entry of navigationEntries) {
    const sections = entry.sections.filter((section) =>
      isSectionAllowed(section, permissions),
    )
    const first = sections[0]
    if (!first) continue
    visible.push({ ...entry, sections, to: entry.to ?? first.to })
  }
  return visible
}

export interface NavLocation {
  entry: VisibleNavEntry
  /** `null` en Inicio y en la página «Ajustes». */
  section: NavSection | null
  subsection: NavSubsection | null
}

const settingsPage = '/settings'

/** Entrada, sección y subsección que corresponden a la ruta, para el menú, las migas y el negocio. */
export function findLocation(
  entries: readonly VisibleNavEntry[],
  pathname: string,
): NavLocation | null {
  if (pathname === '/')
    return { entry: homeEntry, section: null, subsection: null }
  for (const entry of entries) {
    if (entry.id === 'ajustes' && covers(settingsPage, pathname))
      return { entry, section: null, subsection: null }
    const section = entry.sections.find((candidate) =>
      isSectionActive(candidate, pathname),
    )
    if (!section) continue
    const subsection =
      section.subsections?.find((candidate) =>
        covers(candidate.to, pathname),
      ) ?? null
    return { entry, section, subsection }
  }
  return null
}
