import { useState } from 'react'

import { useAudit } from '@/features/audit/hooks'
import type { AuditEvent, AuditFilters } from '@/features/audit/types'

function localDate(value: string) {
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'America/Guayaquil',
  }).format(new Date(value))
}

export function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({ page: 1 })
  const [selected, setSelected] = useState<AuditEvent | null>(null)
  const audit = useAudit(filters)

  return (
    <section>
      <h1 className="text-3xl font-bold">Auditoría</h1>
      <p className="mt-2 text-slate-300">
        Historial inmutable de acciones relevantes de identidad.
      </p>
      <div className="mt-6 grid gap-3 rounded-xl border border-slate-700 p-4 sm:grid-cols-3">
        <label>
          Usuario
          <input
            className="mt-1 min-h-11 w-full rounded-lg bg-slate-900 px-3"
            inputMode="numeric"
            onChange={(event) =>
              setFilters({ ...filters, user: event.target.value, page: 1 })
            }
          />
        </label>
        <label>
          Acción
          <input
            className="mt-1 min-h-11 w-full rounded-lg bg-slate-900 px-3"
            onChange={(event) =>
              setFilters({ ...filters, action: event.target.value, page: 1 })
            }
          />
        </label>
        <label>
          Resultado
          <select
            className="mt-1 min-h-11 w-full rounded-lg bg-slate-900 px-3"
            onChange={(event) =>
              setFilters({
                ...filters,
                result: (event.target.value || undefined) as
                  | AuditEvent['result']
                  | undefined,
                page: 1,
              })
            }
          >
            <option value="">Todos</option>
            <option value="SUCCESS">Éxito</option>
            <option value="FAILURE">Fallo</option>
            <option value="DENIED">Denegado</option>
          </select>
        </label>
        <label>
          Desde
          <input
            className="mt-1 min-h-11 w-full rounded-lg bg-slate-900 px-3"
            onChange={(event) =>
              setFilters({
                ...filters,
                from: event.target.value
                  ? new Date(event.target.value).toISOString()
                  : undefined,
                page: 1,
              })
            }
            type="datetime-local"
          />
        </label>
        <label>
          Hasta
          <input
            className="mt-1 min-h-11 w-full rounded-lg bg-slate-900 px-3"
            onChange={(event) =>
              setFilters({
                ...filters,
                to: event.target.value
                  ? new Date(event.target.value).toISOString()
                  : undefined,
                page: 1,
              })
            }
            type="datetime-local"
          />
        </label>
        <label>
          Tipo de objeto
          <input
            className="mt-1 min-h-11 w-full rounded-lg bg-slate-900 px-3"
            onChange={(event) =>
              setFilters({
                ...filters,
                targetType: event.target.value,
                page: 1,
              })
            }
          />
        </label>
      </div>
      {audit.isPending && <p className="mt-6">Cargando auditoría…</p>}
      {audit.isError && (
        <p className="mt-6 text-rose-300" role="alert">
          No fue posible consultar la auditoría.
        </p>
      )}
      {audit.isSuccess && audit.data.results.length === 0 && (
        <p className="mt-6">No existen eventos para estos filtros.</p>
      )}
      {audit.isSuccess && audit.data.results.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="p-3">Fecha</th>
                <th className="p-3">Usuario</th>
                <th className="p-3">Acción</th>
                <th className="p-3">Resultado</th>
                <th className="p-3">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.results.map((event) => (
                <tr className="border-b border-slate-800" key={event.id}>
                  <td className="p-3">{localDate(event.occurred_at)}</td>
                  <td className="p-3">
                    {event.actor?.username ?? 'Sistema o no confirmado'}
                  </td>
                  <td className="p-3">{event.action}</td>
                  <td className="p-3">{event.result}</td>
                  <td className="p-3">
                    <button onClick={() => setSelected(event)} type="button">
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-between">
            <button
              disabled={audit.data.page <= 1}
              onClick={() =>
                setFilters({ ...filters, page: (filters.page ?? 1) - 1 })
              }
            >
              Anterior
            </button>
            <span>
              Página {audit.data.page} de {Math.max(audit.data.total_pages, 1)}
            </span>
            <button
              disabled={audit.data.page >= audit.data.total_pages}
              onClick={() =>
                setFilters({ ...filters, page: (filters.page ?? 1) + 1 })
              }
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
      {selected && (
        <div
          aria-modal="true"
          className="fixed inset-0 grid place-items-center bg-slate-950/80 p-5"
          role="dialog"
        >
          <div className="max-h-[90vh] max-w-xl overflow-auto rounded-xl bg-slate-800 p-6">
            <h2 className="text-xl font-bold">Detalle del evento</h2>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-2">
              <dt>Acción</dt>
              <dd>{selected.action}</dd>
              <dt>Objeto</dt>
              <dd>
                {selected.target_type} {selected.target_id}
              </dd>
              <dt>Motivo</dt>
              <dd>{selected.reason ?? 'Sin motivo'}</dd>
              <dt>Solicitud</dt>
              <dd>{selected.request_id ?? 'No disponible'}</dd>
            </dl>
            <pre className="mt-4 overflow-auto rounded bg-slate-950 p-3 text-sm">
              {JSON.stringify(selected.metadata, null, 2)}
            </pre>
            <button
              className="mt-4 min-h-11 rounded-lg bg-cyan-400 px-4 text-slate-950"
              onClick={() => setSelected(null)}
              type="button"
            >
              Cerrar detalle
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
