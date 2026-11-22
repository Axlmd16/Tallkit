import {
  ArrowCounterClockwise,
  ArrowRight,
  ClockCounterClockwise,
  Heart,
  SlidersHorizontal,
  Tag,
  Truck,
  Users,
} from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { Tabs, type TabItem } from '@/shared/ui'

import { BusinessCards } from './BusinessCards'

function SectionCard({
  icon,
  title,
  description,
  actionLabel,
  to,
}: {
  icon: ReactNode
  title: string
  description: string
  actionLabel: string
  to: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface p-5">
      <div className="flex min-w-0 items-start gap-3.5">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-control bg-surface-subtle text-ink-muted"
        >
          {icon}
        </span>
        <div className="min-w-0 leading-snug">
          <h2 className="text-block font-bold text-ink">{title}</h2>
          <p className="mt-0.5 text-body text-ink-muted">{description}</p>
        </div>
      </div>
      <Link
        className="ui-button inline-flex min-h-10 items-center gap-2 rounded-control border border-ink px-4 text-body font-semibold text-ink hover:bg-ink hover:text-white"
        to={to}
      >
        {actionLabel}
        <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </div>
  )
}

function BrandsPanel({ permissions }: { permissions: Set<string> }) {
  const items = [
    {
      show: permissions.has('marcas_vehiculo.ver'),
      title: 'Marcas de vehículos',
      description: 'Catálogo de marcas usadas al registrar vehículos.',
      to: '/vehicle-brands',
    },
    {
      show: permissions.has('productos.ver'),
      title: 'Marcas de producto',
      description: 'Fabricantes y marcas de repuestos del almacén.',
      to: '/product-brands',
    },
    {
      show: permissions.has('productos.ver'),
      title: 'Categorías de producto',
      description: 'Agrupación de repuestos en el catálogo y filtros.',
      to: '/product-categories',
    },
    {
      show: permissions.has('productos.ver'),
      title: 'Unidades de medida',
      description: 'Presentaciones y unidades usadas en los productos.',
      to: '/measurement-units',
    },
  ].filter((item) => item.show)

  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      {items.map((item) => (
        <Link
          className="flex items-start gap-3.5 rounded-card border border-line bg-surface p-4 transition-colors hover:bg-surface-subtle"
          key={item.to}
          to={item.to}
        >
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-subtle text-ink-muted"
          >
            <Tag size={18} />
          </span>
          <span className="min-w-0 flex-1 leading-snug">
            <span className="block text-body font-semibold text-ink">
              {item.title}
            </span>
            <span className="mt-0.5 block text-label text-ink-muted">
              {item.description}
            </span>
          </span>
          <ArrowRight
            aria-hidden="true"
            className="mt-1 shrink-0 text-ink-muted"
            size={16}
          />
        </Link>
      ))}
    </div>
  )
}

/**
 * Ajustes (pantalla 14): reúne por pestañas los dos negocios con su avance fiscal,
 * las personas con acceso, proveedores, marcas/catálogos, historial de cambios y estado
 * del sistema. Cada pestaña se muestra solo si la sesión tiene su permiso.
 */
export function SettingsPage() {
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const [params, setParams] = useSearchParams()

  const canConfig = permissions.has('parametros.gestionar')
  const canUsers = permissions.has('usuarios.ver')
  const canSuppliers = permissions.has('proveedores.ver')
  const canBrands =
    permissions.has('marcas_vehiculo.ver') || permissions.has('productos.ver')
  const canAudit = permissions.has('auditoria.ver')
  const canSystem = permissions.has('operacion.ver_estado')

  const tabs: TabItem[] = [
    ...(canConfig
      ? [
          {
            id: 'negocios',
            label: 'Negocios',
            content: <BusinessCards />,
          },
        ]
      : []),
    ...(canUsers
      ? [
          {
            id: 'personas',
            label: 'Personas con acceso',
            content: (
              <SectionCard
                actionLabel="Administrar usuarios"
                description="Crea cuentas, asigna roles por negocio y revoca accesos cuando haga falta."
                icon={<Users size={20} />}
                title="Personas con acceso"
                to="/users"
              />
            ),
          },
        ]
      : []),
    ...(canSuppliers
      ? [
          {
            id: 'proveedores',
            label: 'Proveedores',
            content: (
              <SectionCard
                actionLabel="Ver proveedores"
                description="Directorio de proveedores para las entradas de mercadería."
                icon={<Truck size={20} />}
                title="Proveedores"
                to="/suppliers"
              />
            ),
          },
        ]
      : []),
    ...(canBrands
      ? [
          {
            id: 'marcas',
            label: 'Marcas',
            content: <BrandsPanel permissions={permissions} />,
          },
        ]
      : []),
    ...(canAudit
      ? [
          {
            id: 'auditoria',
            label: 'Historial de cambios',
            content: (
              <SectionCard
                actionLabel="Ver historial de cambios"
                description="Registro de acciones relevantes realizadas por cada usuario."
                icon={<ClockCounterClockwise size={20} />}
                title="Historial de cambios"
                to="/audit"
              />
            ),
          },
        ]
      : []),
    ...(canSystem
      ? [
          {
            id: 'sistema',
            label: 'Sistema',
            content: (
              <SectionCard
                actionLabel="Ver estado del sistema"
                description="Salud del servicio, base de datos y configuración operativa."
                icon={<Heart size={20} />}
                title="Sistema"
                to="/technical-status"
              />
            ),
          },
        ]
      : []),
  ]

  const requested = params.get('tab')
  const activeTab =
    requested && tabs.some((item) => item.id === requested)
      ? requested
      : (tabs[0]?.id ?? '')

  return (
    <div className="catalog-page list-page space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-card bg-graphite text-primary"
          >
            <SlidersHorizontal size={22} weight="bold" />
          </span>
          <div className="min-w-0 leading-snug">
            <p className="text-label font-medium text-ink-muted">Se usa poco</p>
            <h1 className="text-page font-bold tracking-tight text-ink">
              Ajustes
            </h1>
            <p className="mt-0.5 text-body text-ink-muted">
              Los datos de cada negocio, quién entra al sistema y lo que se
              configura una vez.
            </p>
          </div>
        </div>
        {canConfig && (
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-control px-3 text-body font-semibold text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
            to="/configuration/setup"
          >
            <ArrowCounterClockwise aria-hidden="true" size={16} />
            Repetir la guía inicial
          </Link>
        )}
      </header>

      {tabs.length > 0 ? (
        <Tabs
          activeId={activeTab}
          aria-label="Secciones de ajustes"
          items={tabs}
          onChange={(next) => {
            const updated = new URLSearchParams(params)
            if (next === tabs[0]?.id) updated.delete('tab')
            else updated.set('tab', next)
            setParams(updated, { replace: true })
          }}
          panelClassName="pt-5"
        />
      ) : (
        <p className="text-body text-ink-muted">
          No tiene permisos asignados para secciones de ajustes.
        </p>
      )}
    </div>
  )
}
