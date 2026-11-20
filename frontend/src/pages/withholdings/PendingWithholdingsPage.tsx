import { SealPercent } from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'

import { AccountsHeader } from '@/features/accounts/AccountsHeader'
import { useSession } from '@/features/auth/hooks'
import {
  useBillingMutations,
  usePendingArtisanWithholdings,
} from '@/features/maintenance/billingHooks'
import {
  usePendingWithholdings,
  useSaleMutations,
} from '@/features/sales/hooks'
import type { PendingWithholding } from '@/features/sales/types'
import {
  VoidWithholdingDialog,
  VoucherDialog,
  type WithholdingScope,
} from '@/features/sales/WithholdingRecords'
import {
  Button,
  EmptyState,
  InlineNotice,
  LoadingState,
  Money,
  PageHeader,
  useToast,
} from '@/shared/ui'

type Dialog =
  | { kind: 'voucher'; item: PendingWithholding }
  | { kind: 'void'; item: PendingWithholding }
  | null

const texts = {
  commercial: {
    title: 'Retenciones por completar',
    description:
      'Retenciones de ventas de repuestos a las que todavía les falta el número de comprobante.',
    back: '/sales/receivables',
    backLabel: 'Volver a cuentas por cobrar',
    register: 'pagos_comerciales.registrar',
    admin: 'pagos_comerciales.anular',
  },
  artesanal: {
    title: 'Retenciones de servicios por completar',
    description:
      'Retenciones de servicios del taller a las que todavía les falta el número de comprobante.',
    back: '/maintenance/receivables',
    backLabel: 'Volver a cuentas por cobrar de servicios',
    register: 'pagos_artesanales.registrar',
    admin: 'pagos_artesanales.anular',
  },
} as const

function operationOf(item: PendingWithholding, scope: WithholdingScope) {
  return scope === 'commercial'
    ? {
        id: item.sale_id ?? 0,
        label: item.sale_number ?? `Venta #${item.sale_id}`,
        to: `/sales/${item.sale_id}`,
      }
    : {
        id: item.service_operation_id ?? 0,
        label:
          item.operation_number ?? `Operación #${item.service_operation_id}`,
        to: `/maintenance/service-operations/${item.service_operation_id}`,
      }
}

/**
 * Seguimiento de retenciones con comprobante pendiente de un solo RUC. El comprobante
 * electrónico llega días después del cobro: aquí se completa su número. Las retenciones
 * de los dos RUC nunca se mezclan en la misma lista.
 */
export function PendingWithholdingsPage({
  scope,
}: {
  scope: WithholdingScope
}) {
  const text = texts[scope]
  const commercial = scope === 'commercial'
  const [page, setPage] = useState(1)
  const [customer, setCustomer] = useState<{ id: number; name: string } | null>(
    null,
  )
  const [dialog, setDialog] = useState<Dialog>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const toast = useToast()
  const permissions = new Set(useSession().data?.permissions ?? [])
  const sales = usePendingWithholdings(page, commercial, customer?.id)
  const artisan = usePendingArtisanWithholdings(page, !commercial, customer?.id)
  const query = commercial ? sales : artisan
  const saleMutations = useSaleMutations()
  const billingMutations = useBillingMutations()
  const canComplete = permissions.has(text.register)
  const canAdmin = permissions.has(text.admin)

  const open = (next: Dialog, origin: HTMLElement) => {
    returnFocus.current = origin
    setDialog(next)
  }
  const done = (message: string) => {
    setDialog(null)
    toast.success(message)
  }

  const data = query.data
  const pages = data
    ? Math.max(Math.ceil(data.total_count / data.page_size), 1)
    : 1

  return (
    <div className="catalog-page list-page space-y-4">
      <PageHeader
        icon={<SealPercent />}
        description={text.description}
        title={text.title}
      />
      <AccountsHeader business={scope} view="withholdings" />
      <div className="flex flex-wrap items-center gap-3">
        {data && (
          <p className="text-body text-ink-muted">
            <span className="font-semibold text-ink">
              <Money amount={data.pending_total} />
            </span>{' '}
            en {data.total_count}{' '}
            {data.total_count === 1 ? 'retención' : 'retenciones'} (todas las
            coincidencias).
          </p>
        )}
      </div>
      {customer && (
        <div
          aria-label="Filtro por cliente"
          className="flex flex-wrap items-center gap-3 rounded-control border border-line bg-surface-subtle px-3 py-2 text-body"
          role="group"
        >
          <span>
            Solo retenciones de{' '}
            <span className="font-semibold text-ink">{customer.name}</span>
          </span>
          <Button
            onClick={() => {
              setCustomer(null)
              setPage(1)
            }}
            type="button"
            variant="quiet"
          >
            Ver todos los clientes
          </Button>
        </div>
      )}
      <InlineNotice title="¿Dónde está el comprobante?" tone="info">
        El cliente lo emite de forma electrónica. Búsquelo en SRI en línea, en
        comprobantes electrónicos recibidos, o en el correo registrado.
      </InlineNotice>

      {query.isPending && <LoadingState label="Cargando retenciones…" />}
      {query.isError && (
        <InlineNotice
          title="No se pudieron consultar las retenciones"
          tone="danger"
        >
          <Button
            onClick={() => void query.refetch()}
            type="button"
            variant="secondary"
          >
            Reintentar
          </Button>
        </InlineNotice>
      )}
      {data && data.items.length === 0 && (
        <EmptyState
          description={
            customer
              ? 'Este cliente no tiene retenciones sin número de comprobante.'
              : 'Todas las retenciones registradas ya tienen su número de comprobante.'
          }
          title="Nada por completar"
        />
      )}
      {data && data.items.length > 0 && (
        <section
          aria-label={text.title}
          className="overflow-hidden rounded-panel border border-line bg-surface"
        >
          <ul className="divide-y divide-line text-body">
            {data.items.map((item) => {
              const operation = operationOf(item, scope)
              return (
                <li
                  aria-label={`Retención de ${operation.label}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                  key={item.id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">
                      {item.customer.name ?? 'Cliente'}{' '}
                      <span className="font-normal text-ink-muted">
                        {item.customer.identification}
                      </span>
                      {!customer && (
                        <button
                          className="ml-2 text-label font-semibold text-accent hover:underline"
                          onClick={() => {
                            setCustomer({
                              id: item.customer.id,
                              name: item.customer.name ?? 'este cliente',
                            })
                            setPage(1)
                          }}
                          type="button"
                        >
                          Ver solo este cliente
                        </button>
                      )}
                    </p>
                    <p className="text-ink-muted">
                      <Link
                        className="code font-semibold text-accent hover:underline"
                        to={operation.to}
                      >
                        {operation.label}
                      </Link>{' '}
                      · {item.effective_date} · hace {item.age_days}{' '}
                      {item.age_days === 1 ? 'día' : 'días'}
                    </p>
                  </div>
                  <Money amount={item.amount} className="font-semibold" />
                  <span className="flex flex-wrap gap-2">
                    {canComplete && (
                      <Button
                        onClick={(event) =>
                          open({ kind: 'voucher', item }, event.currentTarget)
                        }
                        type="button"
                        variant="soft"
                      >
                        Completar comprobante
                      </Button>
                    )}
                    {canAdmin && (
                      <Button
                        onClick={(event) =>
                          open({ kind: 'void', item }, event.currentTarget)
                        }
                        type="button"
                        variant="ghost"
                      >
                        Anular retención
                      </Button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
          {pages > 1 && (
            <nav
              aria-label="Paginación"
              className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-body"
            >
              <Button
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                type="button"
                variant="secondary"
              >
                Anterior
              </Button>
              <span className="text-ink-muted">
                Página {page} de {pages}
              </span>
              <Button
                disabled={page >= pages}
                onClick={() => setPage((current) => current + 1)}
                type="button"
                variant="secondary"
              >
                Siguiente
              </Button>
            </nav>
          )}
        </section>
      )}

      {dialog?.kind === 'voucher' && (
        <VoucherDialog
          onClose={() => setDialog(null)}
          onDone={done}
          onSubmit={(input, key) => {
            const target = operationOf(dialog.item, scope).id
            return commercial
              ? saleMutations.completeVoucher.mutateAsync({
                  ...input,
                  id: target,
                  withholdingId: dialog.item.id,
                  key,
                })
              : billingMutations.completeVoucher.mutateAsync({
                  ...input,
                  id: target,
                  withholdingId: dialog.item.id,
                  key,
                })
          }}
          returnFocusRef={returnFocus}
          scope={scope}
          withholding={dialog.item}
        />
      )}
      {dialog?.kind === 'void' && (
        <VoidWithholdingDialog
          onClose={() => setDialog(null)}
          onDone={done}
          onSubmit={(reason, key) => {
            const target = operationOf(dialog.item, scope).id
            return commercial
              ? saleMutations.voidWithholding.mutateAsync({
                  id: target,
                  withholdingId: dialog.item.id,
                  reason,
                  key,
                })
              : billingMutations.voidWithholding.mutateAsync({
                  id: target,
                  withholdingId: dialog.item.id,
                  reason,
                  key,
                })
          }}
          returnFocusRef={returnFocus}
          scope={scope}
          withholding={dialog.item}
        />
      )}
    </div>
  )
}
