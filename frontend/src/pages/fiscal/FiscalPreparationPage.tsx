import { ArrowLeft, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router'

import {
  useEstablishments,
  useFiscalMutations,
  usePreparation,
} from '@/features/fiscal/hooks'
import type { DraftUpdate, FiscalPreparationDetail } from '@/features/fiscal/types'
import {
  Button,
  ErrorState,
  getControlClasses,
  InlineNotice,
  LoadingState,
  StatusBadge,
  Surface,
} from '@/shared/ui'

const stateLabels = {
  DRAFT: 'Borrador local',
  PREPARED: 'Preparada localmente',
  CANCELLED: 'Cancelada localmente',
} as const

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : ''
}

function DraftForm({ detail }: { detail: FiscalPreparationDetail }) {
  const mutations = useFiscalMutations()
  const locations = useEstablishments(detail.fiscal_entity_id)
  const draft = detail.draft ?? {}
  const receiver = record(draft.receiver)
  const payments = record(draft.payments)
  const firstPayment = Array.isArray(payments.forms)
    ? record(payments.forms[0])
    : {}
  const points = useMemo(
    () =>
      (locations.data ?? []).flatMap((establishment) =>
        establishment.points
          .filter((point) => point.is_active && establishment.is_active)
          .map((point) => ({
            id: point.id,
            label: `${establishment.code}-${point.code} · ${establishment.address}`,
          })),
      ),
    [locations.data],
  )
  const review = mutations.review.data

  const submitDraft = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const term = String(data.get('term_days') ?? '').trim()
    const unit = String(data.get('time_unit') ?? '').trim()
    const payment: Record<string, unknown> = {
      payment_code: String(data.get('payment_code')),
      amount: String(data.get('amount')).trim(),
    }
    if (term) payment.term_days = Number(term)
    if (unit) payment.time_unit = unit
    const payload: DraftUpdate = {
      expected_version: detail.version,
      point_id: Number(data.get('point_id')),
      environment: String(data.get('environment')) as '1' | '2',
      reference_date: String(data.get('reference_date')),
      receiver: {
        identification_type: String(data.get('identification_type')),
        identification: String(data.get('identification')).trim(),
        legal_name: String(data.get('legal_name')).trim(),
        address: String(data.get('address')).trim() || null,
        email: String(data.get('email')).trim() || null,
      },
      payments: { forms: [payment] },
    }
    mutations.updateDraft.mutate({
      preparationId: detail.preparation_id,
      data: payload,
    })
  }

  return (
    <div className="space-y-4">
      <InlineNotice title="Ambiente de ensayo" tone="info">
        Esta preparación es local. No se envía al SRI y no obtiene autorización.
      </InlineNotice>
      {locations.isError && (
        <ErrorState message="No se pudieron cargar los puntos de emisión." />
      )}
      {mutations.updateDraft.isError && (
        <ErrorState message={mutations.updateDraft.error.message} />
      )}
      <form
        className="space-y-5"
        key={detail.version}
        onSubmit={submitDraft}
      >
        <Surface>
          <h2 className="font-bold text-ink">Datos del comprobante</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Ambiente">
              <select
                className={getControlClasses()}
                defaultValue={draft.environment ?? '1'}
                name="environment"
              >
                <option value="1">Pruebas</option>
                <option value="2">Producción</option>
              </select>
            </Field>
            <Field label="Punto de emisión">
              <select
                className={getControlClasses()}
                defaultValue={draft.point_id ?? ''}
                name="point_id"
                required
              >
                <option disabled value="">
                  Seleccione un punto
                </option>
                {points.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fecha de referencia">
              <input
                className={getControlClasses()}
                defaultValue={draft.reference_date ?? ''}
                name="reference_date"
                required
                type="date"
              />
            </Field>
          </div>
        </Surface>

        <Surface>
          <h2 className="font-bold text-ink">Receptor fiscal declarado</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Estos datos no modifican la ficha del cliente de la operación.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Tipo de identificación">
              <select
                className={getControlClasses()}
                defaultValue={text(receiver.identification_type) || '04'}
                name="identification_type"
              >
                <option value="04">RUC</option>
                <option value="05">Cédula</option>
                <option value="06">Pasaporte</option>
                <option value="07">Consumidor final</option>
                <option value="08">Identificación exterior</option>
              </select>
            </Field>
            <Field label="Identificación">
              <input
                className={getControlClasses()}
                defaultValue={text(receiver.identification)}
                name="identification"
                required
              />
            </Field>
            <Field label="Razón social o nombre">
              <input
                className={getControlClasses()}
                defaultValue={text(receiver.legal_name)}
                name="legal_name"
                required
              />
            </Field>
            <Field label="Dirección fiscal">
              <input
                className={getControlClasses()}
                defaultValue={text(receiver.address)}
                name="address"
              />
            </Field>
            <Field label="Correo informado">
              <input
                className={getControlClasses()}
                defaultValue={text(receiver.email)}
                name="email"
                type="email"
              />
            </Field>
          </div>
        </Surface>

        <Surface>
          <h2 className="font-bold text-ink">Forma fiscal declarada</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Es independiente de los cobros reales. Crédito es una condición y no
            un medio de pago del SRI.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Field label="Medio SRI">
              <select
                className={getControlClasses()}
                defaultValue={text(firstPayment.payment_code) || '01'}
                name="payment_code"
              >
                <option value="01">01 · Efectivo</option>
                <option value="20">20 · Otros con sistema financiero</option>
              </select>
            </Field>
            <Field label="Importe declarado">
              <input
                className={getControlClasses()}
                defaultValue={text(firstPayment.amount)}
                inputMode="decimal"
                name="amount"
                required
              />
            </Field>
            <Field label="Plazo">
              <input
                className={getControlClasses()}
                defaultValue={text(firstPayment.term_days)}
                min="1"
                name="term_days"
                type="number"
              />
            </Field>
            <Field label="Unidad del plazo">
              <select
                className={getControlClasses()}
                defaultValue={text(firstPayment.time_unit)}
                name="time_unit"
              >
                <option value="">Sin declarar</option>
                <option value="dias">Días</option>
                <option value="meses">Meses</option>
              </select>
            </Field>
          </div>
        </Surface>

        <div className="flex flex-wrap justify-end gap-3">
          <Button pending={mutations.updateDraft.isPending} type="submit">
            Guardar borrador
          </Button>
          <Button
            onClick={() =>
              mutations.review.mutate({ preparationId: detail.preparation_id })
            }
            pending={mutations.review.isPending}
            type="button"
            variant="secondary"
          >
            Revisar coherencia
          </Button>
        </div>
      </form>

      {mutations.review.isError && (
        <ErrorState message={mutations.review.error.message} />
      )}
      {review && (
        <Surface>
          <h2 className="font-bold text-ink">Resultado de la revisión</h2>
          {review.impediments.length ? (
            <ul className="mt-3 space-y-2" aria-label="Datos faltantes">
              {review.impediments.map((item, index) => (
                <li
                  className="flex gap-2 rounded-control bg-warning-soft p-3 text-sm text-warning"
                  key={`${item.field}-${index}`}
                >
                  <WarningCircle aria-hidden="true" className="mt-0.5" />
                  <span>
                    <strong>{item.field}:</strong> {item.message}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm text-success">
                <CheckCircle aria-hidden="true" /> Revisión local sin impedimentos.
              </p>
              <Button
                disabled={!review.review_token}
                onClick={() =>
                  review.review_token &&
                  mutations.prepare.mutate({
                    preparationId: detail.preparation_id,
                    reviewToken: review.review_token,
                    attemptKey: crypto.randomUUID(),
                  })
                }
                pending={mutations.prepare.isPending}
              >
                Completar preparación local
              </Button>
            </div>
          )}
        </Surface>
      )}
    </div>
  )
}

function PreparedSnapshot({ detail }: { detail: FiscalPreparationDetail }) {
  const snapshot = record(detail.snapshot)
  const issuer = record(snapshot.issuer)
  const receiver = record(snapshot.receiver)
  const lines = Array.isArray(snapshot.lines) ? snapshot.lines.map(record) : []
  return (
    <div className="space-y-4">
      <InlineNotice title="Instantánea histórica local" tone="info">
        Los datos siguientes permanecen como fueron preparados. No representan
        envío, recepción ni autorización del SRI.
      </InlineNotice>
      <Surface>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Datum label="Emisor" value={text(issuer.legal_name)} />
          <Datum label="RUC" value={text(issuer.ruc)} mono />
          <Datum label="Receptor" value={text(receiver.legal_name)} />
          <Datum
            label="Identificación"
            value={text(receiver.identification)}
            mono
          />
          <Datum label="Base" value={`USD ${text(snapshot.base_total)}`} />
          <Datum label="Impuestos" value={`USD ${text(snapshot.tax_total)}`} />
          <Datum label="Total" value={`USD ${text(snapshot.grand_total)}`} />
          <Datum
            label="Ambiente"
            value={text(issuer.environment) === '1' ? 'Pruebas' : 'Producción'}
          />
        </dl>
      </Surface>
      <Surface className="overflow-hidden p-0">
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-bold text-ink">Valores históricos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-surface-subtle text-xs text-ink-muted">
              <tr>
                <th className="px-4 py-2">Código y descripción</th>
                <th className="px-4 py-2 text-right">Cantidad</th>
                <th className="px-4 py-2 text-right">Base</th>
                <th className="px-4 py-2 text-right">Impuesto</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map((line, index) => (
                <tr key={`${text(line.position)}-${index}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">{text(line.item_code)}</span>
                    <span className="block">{text(line.description)}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {text(line.quantity)}
                  </td>
                  <td className="px-4 py-3 text-right">USD {text(line.base_amount)}</td>
                  <td className="px-4 py-3 text-right">USD {text(line.tax_amount)}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    USD {text(line.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
    </div>
  )
}

export function FiscalPreparationPage() {
  const preparationId = useParams().id
  const query = usePreparation(preparationId)
  if (query.isPending) return <LoadingState label="Cargando preparación fiscal…" />
  if (query.isError || !query.data) {
    return (
      <ErrorState
        message="No se pudo cargar la preparación fiscal."
        onRetry={() => void query.refetch()}
      />
    )
  }
  const detail = query.data
  const sourcePath =
    detail.source.kind === 'COMMERCIAL'
      ? `/sales/${detail.source.id}`
      : `/maintenance/service-operations/${detail.source.id}`
  const changed = detail.discrepancy.source_changed

  return (
    <div className="catalog-page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            aria-label="Volver a la operación"
            className="grid size-10 place-items-center rounded-control border border-line bg-surface"
            to={sourcePath}
          >
            <ArrowLeft aria-hidden="true" />
          </Link>
          <div>
            <p className="text-xs text-ink-muted">Preparación fiscal</p>
            <h1 className="font-mono text-xl font-semibold text-ink">
              {detail.preparation_id}
            </h1>
          </div>
        </div>
        <StatusBadge label={stateLabels[detail.state]} tone="neutral" shape="pill" />
      </div>

      <Surface>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Datum label="Estado fiscal local" value={stateLabels[detail.state]} />
          <Datum label="Estado oficial SRI" value="Sin envío realizado" />
          <Datum label="Cobro real" value="Independiente; consulte la operación" />
          <Datum
            label="Origen"
            value={`${detail.source.kind === 'COMMERCIAL' ? 'Venta' : 'Operación artesanal'} #${detail.source.id}`}
          />
        </dl>
      </Surface>

      {changed && (
        <InlineNotice title="La operación cambió después de esta preparación" tone="warning">
          La instantánea histórica se conserva. El origen está ahora en versión{' '}
          {detail.discrepancy.current_source_version}
          {detail.discrepancy.corrections_changed
            ? ' y registra correcciones posteriores.'
            : '.'}
        </InlineNotice>
      )}
      {detail.state === 'CANCELLED' && (
        <InlineNotice title="Preparación cancelada localmente" tone="warning">
          {detail.cancellation_reason}
        </InlineNotice>
      )}

      {detail.state === 'DRAFT' ? (
        <DraftForm detail={detail} />
      ) : detail.snapshot ? (
        <PreparedSnapshot detail={detail} />
      ) : (
        <InlineNotice title="Instantánea no disponible" tone="warning">
          Esta preparación no conserva valores preparados para mostrar.
        </InlineNotice>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="ui-field block text-sm font-semibold text-ink">
      {label}
      <span className="mt-1.5 block">{children}</span>
    </label>
  )
}

function Datum({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={`mt-1 font-medium ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </dd>
    </div>
  )
}
