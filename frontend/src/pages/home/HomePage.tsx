import {
  ArrowRight,
  ClipboardText,
  Pulse,
  Users,
  ShieldCheck,
  SquaresFour,
  Wrench,
} from '@phosphor-icons/react'
import { Link } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import { EmptyState, PageHeader, Surface } from '@/shared/ui'

const destinations = [
  {
    description: 'Administre las cuentas internas y sus roles vigentes.',
    icon: Users,
    label: 'Usuarios',
    permission: 'usuarios.ver',
    to: '/users',
  },
  {
    description: 'Consulte el historial inmutable de acciones relevantes.',
    icon: ClipboardText,
    label: 'Auditoría',
    permission: 'auditoria.ver',
    to: '/audit',
  },
  {
    description: 'Compruebe la disponibilidad de los servicios locales.',
    icon: Pulse,
    label: 'Estado técnico',
    permission: 'operacion.ver_estado',
    to: '/technical-status',
  },
] as const

export function HomePage() {
  const session = useSession().data
  const permissions = new Set(session?.permissions ?? [])
  const available = destinations.filter((item) =>
    permissions.has(item.permission),
  )
  const stats = [
    {
      label: 'Accesos disponibles',
      value: available.length,
      icon: SquaresFour,
      tone: 'info',
    },
    {
      label: 'Roles asignados',
      value: session?.roles?.length ?? '—',
      icon: ShieldCheck,
      tone: 'yellow',
    },
    { label: 'Sesión local', value: 'Activa', icon: Users, tone: 'coral' },
    {
      label: 'Área de trabajo',
      value: 'Taller',
      icon: Wrench,
      tone: 'primary',
    },
  ] as const

  return (
    <section className="dashboard-page">
      <PageHeader title="Inicio" />
      <div className="dashboard-stats">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <article key={label} className={`stat-${tone}`}>
            <span className="stat-icon">
              <Icon aria-hidden="true" size={28} weight="fill" />
            </span>
            <div>
              <p className="stat-value">{value}</p>
              <p className="stat-label">{label}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="dashboard-panels">
        <Surface className="activity-panel">
          <h2>Actividad del taller</h2>
          <div
            className="empty-chart"
            aria-label="Actividad sin datos disponibles"
          >
            <div className="chart-grid" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i}>—</span>
              ))}
            </div>
            <div className="chart-message">
              <strong>Sin datos disponibles</strong>
              <span>Las métricas aparecerán cuando estén disponibles.</span>
            </div>
            <div className="chart-ticks" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i}>—</span>
              ))}
            </div>
          </div>
        </Surface>
        <Surface className="overview-panel">
          <h2>Resumen de actividad</h2>
          <div className="empty-donut">
            <div>
              <strong>—</strong>
              <span>Sin datos</span>
            </div>
          </div>
          <div className="chart-legend">
            <span>Consulta</span>
            <span>Actividad</span>
            <span>Estado</span>
          </div>
          <p className="sr-only">
            Visualización pendiente de datos; no representa cantidades ni
            proporciones.
          </p>
        </Surface>
        <Surface className="access-panel" aria-label="Accesos disponibles">
          <h2>Área de trabajo</h2>
          {available.length === 0 ? (
            <EmptyState
              title="No hay accesos adicionales disponibles."
              description="La navegación se actualizará cuando su cuenta reciba permisos para otras funciones."
            />
          ) : (
            <>
              <div className="access-head" aria-hidden="true">
                <span>Función</span>
                <span>Acceso</span>
              </div>
              <div className="access-list">
                {available.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link key={item.to} to={item.to}>
                      <span className="access-icon">
                        <Icon aria-hidden="true" size={21} weight="fill" />
                      </span>
                      <span className="access-copy">
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </span>
                      <ArrowRight aria-hidden="true" size={18} />
                    </Link>
                  )
                })}
              </div>
            </>
          )}
        </Surface>
        <Surface className="session-panel">
          <h2>Cuenta y entorno</h2>
          <div className="session-tile">
            <span className="session-symbol">
              <Users aria-hidden="true" size={40} weight="duotone" />
            </span>
            <div>
              <strong>{session?.username ?? 'Cuenta local'}</strong>
              <span>Sesión de trabajo</span>
              <small>Acceso interno</small>
            </div>
          </div>
          <div className="session-tile">
            <span className="session-symbol">
              <Wrench aria-hidden="true" size={40} weight="duotone" />
            </span>
            <div>
              <strong>Sys-Taller</strong>
              <span>Entorno local</span>
              <small>Funciones según permisos</small>
            </div>
          </div>
        </Surface>
      </div>
    </section>
  )
}
