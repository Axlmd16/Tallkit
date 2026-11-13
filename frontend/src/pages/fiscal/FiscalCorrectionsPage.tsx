import { useState } from 'react'

import {
  useCorrection,
  useCorrections,
  useFiscalMutations,
} from '@/features/fiscal/hooks'
import {
  Button,
  ErrorState,
  getControlClasses,
  InlineNotice,
  LoadingState,
  StatusBadge,
  Surface,
} from '@/shared/ui'

const actionLabels = {
  ONLINE_CANCELLATION: 'Solicitud de anulación en línea',
  CREDIT_NOTE: 'Nota de crédito',
}

export function FiscalCorrectionsPage() {
  const list = useCorrections()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detail = useCorrection(selectedId)
  const mutations = useFiscalMutations()
  const [cancelReason, setCancelReason] = useState('')
  const [newAction, setNewAction] = useState<
    'ONLINE_CANCELLATION' | 'CREDIT_NOTE'
  >('ONLINE_CANCELLATION')

  if (list.isPending)
    return <LoadingState label="Cargando solicitudes fiscales…" />
  if (list.isError) {
    return (
      <ErrorState
        message="No se pudieron cargar las solicitudes fiscales."
        onRetry={() => void list.refetch()}
      />
    )
  }

  return (
    <div className="catalog-page space-y-5">
      <div>
        <h1 className="text-page font-semibold text-ink">
          Solicitudes de corrección fiscal
        </h1>
        <p className="mt-1 text-body text-ink-muted">
          Preparación administrativa local. Ninguna acción de esta pantalla
          ejecuta una anulación o nota de crédito ante el SRI.
        </p>
      </div>
      <InlineNotice title="Sin ejecución oficial" tone="info">
        Los estados mostrados describen el trabajo interno y deben conciliarse
        después con evidencia fiscal externa.
      </InlineNotice>

      <Surface>
        <details>
          <summary className="cursor-pointer font-semibold text-accent">
            Registrar solicitud local
          </summary>
          <p className="mt-2 text-body text-ink-muted">
            Use el identificador del expediente XML o de la identidad de ensayo
            que actúa como original. Los hechos desconocidos pueden mantenerse
            pendientes durante la revisión.
          </p>
          {mutations.createCorrection.isError && (
            <div className="mt-3">
              <ErrorState message={mutations.createCorrection.error.message} />
            </div>
          )}
          <form
            className="mt-4 grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget)
              const originalKind = String(data.get('original_kind'))
              const originalValue = String(data.get('original_id')).trim()
              const triState = (name: string) => {
                const value = String(data.get(name))
                return value === '' ? null : value === 'true'
              }
              mutations.createCorrection.mutate({
                attemptKey: crypto.randomUUID(),
                data: {
                  original_dossier_id:
                    originalKind === 'DOSSIER' ? originalValue : null,
                  original_identity_id:
                    originalKind === 'TEST_IDENTITY'
                      ? Number(originalValue)
                      : null,
                  action: newAction,
                  reason: String(data.get('reason')).trim(),
                  reference_date: String(data.get('reference_date')),
                  facts: {
                    consumer_final_transmitted: triState(
                      'consumer_final_transmitted',
                    ),
                    supports_tax_refund: triState('supports_tax_refund'),
                    negotiable_traded: triState('negotiable_traded'),
                    external_history_complete: triState(
                      'external_history_complete',
                    ),
                    holidays_complete: data.get('holidays_complete') === 'on',
                    holidays: String(data.get('holidays'))
                      .split(',')
                      .map((value) => value.trim())
                      .filter(Boolean),
                    calendar_source: String(data.get('calendar_source')).trim(),
                    calendar_version: String(
                      data.get('calendar_version'),
                    ).trim(),
                  },
                  lines:
                    newAction === 'CREDIT_NOTE'
                      ? [
                          {
                            position: Number(data.get('position')),
                            quantity: String(data.get('quantity')).trim(),
                            base_amount: String(data.get('base_amount')).trim(),
                            tax_amount: String(data.get('tax_amount')).trim(),
                            total_amount: String(
                              data.get('total_amount'),
                            ).trim(),
                          },
                        ]
                      : [],
                },
              })
            }}
          >
            <SelectField
              label="Tipo de original"
              name="original_kind"
              options={[
                ['DOSSIER', 'Expediente XML'],
                ['TEST_IDENTITY', 'Identidad de ensayo'],
              ]}
            />
            <TextField label="Identificador del original" name="original_id" />
            <SelectField
              label="Acción solicitada"
              name="action"
              onChange={(value) =>
                setNewAction(value as 'ONLINE_CANCELLATION' | 'CREDIT_NOTE')
              }
              options={[
                ['ONLINE_CANCELLATION', 'Anulación en línea'],
                ['CREDIT_NOTE', 'Nota de crédito'],
              ]}
            />
            <TextField
              label="Fecha de referencia"
              name="reference_date"
              type="date"
            />
            <TextField label="Motivo" name="reason" />
            {(
              [
                ['consumer_final_transmitted', 'Consumidor final transmitido'],
                ['supports_tax_refund', 'Sustenta devolución de impuestos'],
                ['negotiable_traded', 'Factura negociable transada'],
                ['external_history_complete', 'Historia externa completa'],
              ] satisfies Array<[string, string]>
            ).map(([name, label]) => (
              <SelectField
                key={name}
                label={label}
                name={name}
                options={[
                  ['', 'Desconocido'],
                  ['true', 'Sí'],
                  ['false', 'No'],
                ]}
              />
            ))}
            <TextField
              label="Fuente del calendario"
              name="calendar_source"
              required={false}
            />
            <TextField
              label="Versión del calendario"
              name="calendar_version"
              required={false}
            />
            <TextField
              label="Feriados (AAAA-MM-DD, separados por coma)"
              name="holidays"
              required={false}
            />
            <label className="flex items-center gap-2 self-end pb-3 text-body font-semibold text-ink">
              <input name="holidays_complete" type="checkbox" /> Calendario
              completo
            </label>
            {newAction === 'CREDIT_NOTE' && (
              <fieldset className="grid gap-3 border-t border-line pt-3 md:col-span-2 md:grid-cols-5">
                <legend className="px-1 text-body font-semibold text-ink">
                  Línea solicitada
                </legend>
                <TextField label="Posición" name="position" type="number" />
                <TextField label="Cantidad" name="quantity" />
                <TextField label="Base" name="base_amount" />
                <TextField label="Impuesto" name="tax_amount" />
                <TextField label="Total" name="total_amount" />
              </fieldset>
            )}
            <div className="md:col-span-2">
              <Button
                pending={mutations.createCorrection.isPending}
                type="submit"
              >
                Registrar borrador
              </Button>
            </div>
          </form>
        </details>
      </Surface>

      <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.4fr)]">
        <Surface className="overflow-hidden p-0">
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-bold text-ink">Solicitudes locales</h2>
          </div>
          <div className="divide-y divide-line">
            {(list.data ?? []).map((item) => (
              <button
                className="block w-full px-4 py-3 text-left hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-accent"
                key={item.request_id}
                onClick={() => setSelectedId(item.request_id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink">
                    {actionLabels[item.action]}
                  </span>
                  <StatusBadge label={item.state} tone="neutral" shape="pill" />
                </div>
                <p className="mt-1 text-body text-ink-muted">{item.reason}</p>
                <p className="mt-1 text-label text-ink-muted">
                  USD {item.requested_total} · evaluación{' '}
                  {item.evaluation_outcome}
                </p>
              </button>
            ))}
            {!list.data?.length && (
              <p className="px-4 py-6 text-body text-ink-muted">
                No hay solicitudes de corrección registradas.
              </p>
            )}
          </div>
        </Surface>

        <Surface aria-live="polite">
          {!selectedId ? (
            <p className="text-body text-ink-muted">
              Seleccione una solicitud para revisar sus hechos e impedimentos.
            </p>
          ) : detail.isPending ? (
            <LoadingState label="Cargando solicitud…" />
          ) : detail.isError || !detail.data ? (
            <ErrorState message="No se pudo cargar la solicitud seleccionada." />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-ink">
                    {actionLabels[detail.data.action]}
                  </h2>
                  <p className="mt-1 code text-label text-ink-muted">
                    {detail.data.request_id}
                  </p>
                </div>
                <StatusBadge
                  label={detail.data.state}
                  tone="neutral"
                  shape="pill"
                />
              </div>

              <dl className="grid gap-4 text-body sm:grid-cols-2">
                <Datum label="Motivo" value={detail.data.reason} />
                <Datum
                  label="Versión normativa"
                  value={detail.data.normative_version}
                />
                <Datum
                  label="Total solicitado"
                  value={`USD ${detail.data.requested_total}`}
                />
                <Datum label="Ejecución oficial" value="No ejecutada" />
              </dl>

              {detail.data.reconciliation_pending && (
                <InlineNotice title="Conciliación pendiente" tone="warning">
                  Existe evidencia externa todavía no conciliada con el
                  original.
                </InlineNotice>
              )}

              <section>
                <h3 className="font-semibold text-ink">Revisión local</h3>
                <p className="mt-1 text-body text-ink-muted">
                  Resultado: {detail.data.evaluation.outcome}
                </p>
                {!!detail.data.evaluation.pending_facts?.length && (
                  <ul className="mt-3 space-y-2" aria-label="Hechos pendientes">
                    {detail.data.evaluation.pending_facts.map((fact) => (
                      <li
                        className="rounded-control bg-warning-soft px-3 py-2 text-body text-warning"
                        key={fact}
                      >
                        {fact}
                      </li>
                    ))}
                  </ul>
                )}
                {!!detail.data.evaluation.reasons?.length && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-body text-ink-muted">
                    {detail.data.evaluation.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </section>

              {(mutations.prepareCorrection.isError ||
                mutations.cancelCorrection.isError) && (
                <ErrorState
                  message={
                    mutations.prepareCorrection.error?.message ??
                    mutations.cancelCorrection.error?.message ??
                    'No se pudo completar la acción.'
                  }
                />
              )}

              {detail.data.state !== 'CANCELLED' && (
                <div className="space-y-3 border-t border-line pt-4">
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={detail.data.evaluation.outcome !== 'ELIGIBLE'}
                      onClick={() =>
                        mutations.prepareCorrection.mutate({
                          requestId: detail.data.request_id,
                          version: detail.data.version,
                        })
                      }
                      pending={mutations.prepareCorrection.isPending}
                    >
                      Preparar localmente
                    </Button>
                  </div>
                  <form
                    className="flex flex-col gap-3 sm:flex-row sm:items-end"
                    onSubmit={(event) => {
                      event.preventDefault()
                      mutations.cancelCorrection.mutate({
                        requestId: detail.data.request_id,
                        version: detail.data.version,
                        reason: cancelReason,
                      })
                    }}
                  >
                    <label className="grow text-body font-semibold text-ink">
                      Motivo de cancelación local
                      <input
                        className={`${getControlClasses()} mt-1.5`}
                        onChange={(event) =>
                          setCancelReason(event.target.value)
                        }
                        required
                        value={cancelReason}
                      />
                    </label>
                    <Button
                      pending={mutations.cancelCorrection.isPending}
                      type="submit"
                      variant="secondary"
                    >
                      Cancelar solicitud
                    </Button>
                  </form>
                </div>
              )}
            </div>
          )}
        </Surface>
      </div>
    </div>
  )
}

function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label text-ink-muted">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  )
}

function TextField({
  label,
  name,
  required = true,
  type = 'text',
}: {
  label: string
  name: string
  required?: boolean
  type?: string
}) {
  return (
    <label className="text-body font-semibold text-ink">
      {label}
      <input
        className={`${getControlClasses()} mt-1.5`}
        name={name}
        required={required}
        type={type}
      />
    </label>
  )
}

function SelectField({
  label,
  name,
  onChange,
  options,
}: {
  label: string
  name: string
  onChange?: (value: string) => void
  options: Array<[string, string]>
}) {
  return (
    <label className="text-body font-semibold text-ink">
      {label}
      <select
        className={`${getControlClasses()} mt-1.5`}
        name={name}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {options.map(([value, text]) => (
          <option key={value || 'unknown'} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}
