import { Eye, CalendarBlank } from '@phosphor-icons/react'
import { useState } from 'react'

import { useAudit } from '@/features/audit/hooks'
import type { AuditEvent, AuditFilters } from '@/features/audit/types'
import {
  Button,
  Dialog,
  ElevatedDataList,
  EmptyState,
  Field,
  FilterPanel,
  InlineNotice,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  RowActions,
  Select,
  StatusBadge,
} from '@/shared/ui'

function localDate(value: string) {
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'America/Guayaquil',
  }).format(new Date(value))
}

const resultPresentation = {
  SUCCESS: { label: 'Éxito', tone: 'success' },
  FAILURE: { label: 'Fallo', tone: 'danger' },
  DENIED: { label: 'Denegado', tone: 'warning' },
} as const

export function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({ page: 1 })
  const [selected, setSelected] = useState<AuditEvent | null>(null)
  const audit = useAudit(filters)
  const columns = [
    {
      header: 'Fecha',
      key: 'occurred_at' as const,
      priority: 'primary' as const,
      render: (event: AuditEvent) => (
        <span className="audit-date numeric">
          <CalendarBlank aria-hidden="true" size={16} weight="fill" />
          {localDate(event.occurred_at)}
        </span>
      ),
    },
    {
      header: 'Usuario',
      key: 'actor' as const,
      priority: 'primary' as const,
      render: (event: AuditEvent) =>
        event.actor?.username ?? 'Sistema o no confirmado',
    },
    { header: 'Acción', key: 'action' as const, priority: 'primary' as const },
    {
      header: 'Resultado',
      key: 'result' as const,
      priority: 'secondary' as const,
      render: (event: AuditEvent) => {
        const result = resultPresentation[event.result]
        return <StatusBadge label={result.label} tone={result.tone} />
      },
    },
  ]

  return (
    <section className="audit-page list-page">
      <PageHeader
        description="Historial inmutable de acciones relevantes de identidad."
        title="Auditoría"
      />
      <FilterPanel label="Filtros de auditoría">
        <div className="audit-filters grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field id="audit-user" label="Usuario">
            <Input
              inputMode="numeric"
              onChange={(event) =>
                setFilters({ ...filters, user: event.target.value, page: 1 })
              }
            />
          </Field>
          <Field id="audit-action" label="Acción">
            <Input
              onChange={(event) =>
                setFilters({ ...filters, action: event.target.value, page: 1 })
              }
            />
          </Field>
          <Field id="audit-result" label="Resultado">
            <Select
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
            </Select>
          </Field>
          <Field id="audit-from" label="Desde">
            <Input
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
          </Field>
          <Field id="audit-to" label="Hasta">
            <Input
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
          </Field>
          <Field id="audit-target" label="Tipo de objeto">
            <Input
              onChange={(event) =>
                setFilters({
                  ...filters,
                  targetType: event.target.value,
                  page: 1,
                })
              }
            />
          </Field>
        </div>
      </FilterPanel>

      {audit.isPending && <LoadingState label="Cargando auditoría…" />}
      {audit.isError && (
        <div className="mt-6">
          <InlineNotice
            title="No fue posible consultar la auditoría."
            tone="danger"
          />
        </div>
      )}
      {audit.isSuccess && audit.data.results.length === 0 && (
        <div className="mt-6">
          <EmptyState
            description="Cambie los filtros para consultar un período o acción diferente."
            title="No existen eventos para estos filtros."
          />
        </div>
      )}
      {audit.isSuccess && audit.data.results.length > 0 && (
        <>
          <ElevatedDataList
            actions={(event) => (
              <RowActions>
                <Button onClick={() => setSelected(event)} variant="quiet">
                  <Eye aria-hidden="true" size={18} /> Ver
                </Button>
              </RowActions>
            )}
            columns={columns}
            getRowKey={(event) => event.id}
            label="Eventos de auditoría"
            rows={audit.data.results}
          />
          <Pagination
            onNext={() =>
              setFilters({ ...filters, page: (filters.page ?? 1) + 1 })
            }
            onPrevious={() =>
              setFilters({ ...filters, page: (filters.page ?? 1) - 1 })
            }
            page={audit.data.page}
            totalPages={audit.data.total_pages}
          />
        </>
      )}

      <Dialog
        description="Información registrada para rastrear la acción sin exponer datos sensibles."
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        title="Detalle del evento"
      >
        {selected && (
          <div className="min-w-0 w-full">
            <dl className="grid grid-cols-[minmax(6rem,auto)_minmax(0,1fr)] gap-3 text-sm">
              <dt className="font-semibold text-ink-muted">Acción</dt>
              <dd className="break-words">{selected.action}</dd>
              <dt className="font-semibold text-ink-muted">Objeto</dt>
              <dd className="break-words">
                {selected.target_type} {selected.target_id}
              </dd>
              <dt className="font-semibold text-ink-muted">Motivo</dt>
              <dd className="break-words">{selected.reason ?? 'Sin motivo'}</dd>
              <dt className="font-semibold text-ink-muted">Solicitud</dt>
              <dd className="break-all">
                {selected.request_id ?? 'No disponible'}
              </dd>
            </dl>
            <pre className="mt-4 max-w-full overflow-auto rounded-control bg-surface-subtle p-3 text-sm">
              {JSON.stringify(selected.metadata, null, 2)}
            </pre>
          </div>
        )}
        <Button data-autofocus onClick={() => setSelected(null)}>
          Cerrar detalle
        </Button>
      </Dialog>
    </section>
  )
}
