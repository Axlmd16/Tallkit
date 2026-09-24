import { ArrowLeft } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import {
  useMaintenanceMutations,
  useMaintenanceOrder,
} from '@/features/maintenance/hooks'
import {
  initialValues,
  OrderForm,
  type OrderFormValues,
} from '@/features/maintenance/OrderForm'
import type { OdometerWarning, OrderInput } from '@/features/maintenance/types'
import { ProblemError } from '@/shared/api/client'
import { useIntentTracker } from '@/shared/api/idempotency'
import { Button, InlineNotice, LoadingState, useToast } from '@/shared/ui'

function odometerWarningOf(error: unknown): OdometerWarning | null {
  if (
    error instanceof ProblemError &&
    error.code === 'odometer_confirmation_required' &&
    error.details
  ) {
    const d = error.details
    return {
      last_known_km: Number(d.last_known_km),
      order_id: Number(d.order_id),
      order_number: String(d.order_number ?? ''),
    }
  }
  return null
}

/**
 * Registro y edición de una orden en estado registrado. Ante un error recuperable conserva
 * lo escrito; ante un conflicto de versión permite recargar la vigente sin descartarlo.
 */
export function MaintenanceOrderEditorPage() {
  const { id } = useParams()
  const orderId = id ? Number(id) : null
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const tracker = useIntentTracker()
  const mutations = useMaintenanceMutations()
  const detail = useMaintenanceOrder(orderId)
  const order = orderId ? detail.data : undefined
  const presetCustomer = Number(searchParams.get('customer_id')) || null
  const [values, setValues] = useState<OrderFormValues | null>(
    orderId
      ? null
      : initialValues(undefined, {
          customer: presetCustomer
            ? {
                id: presetCustomer,
                label: searchParams.get('customer_name') ?? 'Cliente',
              }
            : null,
          vehicleId: Number(searchParams.get('vehicle_id')) || null,
        }),
  )
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [warning, setWarning] = useState<OdometerWarning | null>(null)
  const [reloaded, setReloaded] = useState(false)

  useEffect(() => {
    if (order?.state === 'REGISTERED' && values === null)
      setValues(initialValues(order))
  }, [order, values])

  if (orderId && detail.isPending) {
    return <LoadingState label="Cargando orden…" />
  }
  if (orderId && (detail.isError || !order)) {
    return (
      <InlineNotice title="No se pudo cargar la orden" tone="danger">
        Vuelva a la lista e inténtelo de nuevo.
      </InlineNotice>
    )
  }
  if (order && order.state !== 'REGISTERED') {
    return (
      <InlineNotice title="La orden no admite edición" tone="warning">
        Solo una orden registrada puede editarse. Consulte su{' '}
        <Link
          className="font-semibold underline"
          to={`/maintenance/${order.id}`}
        >
          detalle
        </Link>
        .
      </InlineNotice>
    )
  }
  if (!values) return <LoadingState label="Preparando formulario…" />

  const pending = mutations.create.isPending || mutations.update.isPending
  const back = order ? `/maintenance/${order.id}` : '/maintenance'

  async function save(data: OrderInput) {
    setProblem(null)
    try {
      const saved = await tracker.run(data, (key) =>
        order
          ? mutations.update.mutateAsync({
              id: order.id,
              data,
              expectedVersion: order.version,
              key,
            })
          : mutations.create.mutateAsync({ data, key }),
      )
      toast.success(
        order
          ? `Orden ${saved.number} actualizada.`
          : `Orden ${saved.number} registrada.`,
      )
      void navigate(`/maintenance/${saved.id}`)
    } catch (error) {
      setWarning(odometerWarningOf(error))
      setProblem(describeProblem(error))
    }
  }

  return (
    <div className="catalog-page space-y-4">
      <div className="flex items-center gap-3">
        <Link
          aria-label="Volver"
          className="grid size-10 shrink-0 place-items-center rounded-control border border-line bg-surface text-ink-muted hover:text-ink"
          title="Volver"
          to={back}
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">Mantenimientos</p>
          <h1 className="text-[22px] leading-7 font-semibold text-ink">
            {order ? `Editar ${order.number}` : 'Nueva orden de mantenimiento'}
          </h1>
        </div>
      </div>
      {problem && !warning && (
        <InlineNotice
          title={
            problem.staleRecord
              ? 'La orden cambió desde que la abrió'
              : 'No se guardó la orden'
          }
          tone="danger"
        >
          <p>{problem.message}</p>
          {problem.staleRecord && (
            <div className="mt-2">
              <Button
                onClick={() => {
                  void detail.refetch().then(() => {
                    setReloaded(true)
                    setProblem(null)
                  })
                }}
                type="button"
                variant="secondary"
              >
                Cargar la versión vigente conservando lo escrito
              </Button>
            </div>
          )}
        </InlineNotice>
      )}
      {reloaded && (
        <InlineNotice title="Versión vigente cargada" tone="info">
          Sus cambios se conservaron. Revíselos y guarde de nuevo.
        </InlineNotice>
      )}
      <OrderForm
        fieldErrors={problem?.fields ?? {}}
        odometerWarning={warning}
        onCancel={() => void navigate(back)}
        onChange={setValues}
        onSubmit={save}
        order={order}
        pending={pending}
        values={values}
      />
    </div>
  )
}
