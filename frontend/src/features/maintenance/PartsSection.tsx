import { NotePencil, Package, Plus, Trash } from '@phosphor-icons/react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import { describeProblem } from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  Combobox,
  type ComboboxOption,
  type ComboboxResults,
  ConfirmationPanel,
  Field,
  FormModal,
  IconButton,
  InlineNotice,
  Input,
  LoadingState,
  Money,
  SectionPanel,
  StatusBadge,
} from '@/shared/ui'

import {
  useBillingMutations,
  useOrderParts,
  usePartProductPicker,
} from './billingHooks'
import type { LinkedSale, MaintenanceOrder } from './types'

type DraftLine = LinkedSale['lines'][number]
type Editing = { line: DraftLine | null } | null

/** Buscador de repuestos ligado a la orden; conserva la regla de hooks con un nombre ``use``. */
function makePartOptions(orderId: number) {
  return function usePartOptions(term: string, page: number): ComboboxResults {
    return usePartProductPicker(orderId, term, page)
  }
}

/**
 * Repuestos de la orden como venta comercial vinculada (RUC comercial). Agregar reserva
 * disponibilidad sin descontar inventario ni generar deuda; la salida ocurre cuando el
 * Vendedor o el Administrador confirma la venta. Las ventas confirmadas no se editan aquí.
 */
export function PartsSection({
  order,
  onDone,
  canOpenSales,
  canSeeKardex = false,
}: {
  order: MaintenanceOrder
  onDone: (message: string) => void
  canOpenSales: boolean
  /** Con `inventario.ver`, cada repuesto confirmado enlaza a su Kardex. */
  canSeeKardex?: boolean
}) {
  const canManage = (order.billing_actions ?? []).includes('manage_parts')
  const query = useOrderParts(order.id)
  const [editing, setEditing] = useState<Editing>(null)
  const [removing, setRemoving] = useState<DraftLine | null>(null)
  const [removeError, setRemoveError] = useState('')
  const returnFocus = useRef<HTMLElement | null>(null)
  const mutations = useBillingMutations()
  const tracker = useIntentTracker()

  const sales = query.data ?? []
  const draft = sales.find((sale) => sale.state === 'DRAFT') ?? null
  const confirmed = sales.filter((sale) => sale.state !== 'DRAFT')

  async function remove(line: DraftLine) {
    setRemoveError('')
    try {
      await tracker.run({ removePart: line.id }, (key) =>
        mutations.removePart.mutateAsync({
          id: order.id,
          lineId: line.id,
          expectedVersion: order.version,
          key,
        }),
      )
      setRemoving(null)
      onDone(
        `Repuesto «${line.product_name ?? ''}» retirado; su reserva quedó liberada.`,
      )
    } catch (error) {
      setRemoveError(describeProblem(error).message)
    }
  }

  return (
    <SectionPanel
      actions={
        canManage && (
          <Button
            onClick={(event) => {
              returnFocus.current = event.currentTarget
              setEditing({ line: null })
            }}
            type="button"
            variant="soft"
          >
            <Plus aria-hidden="true" size={16} />
            Agregar repuesto
          </Button>
        )
      }
      description="Venta comercial vinculada (RUC comercial), separada de los servicios."
      icon={<Package size={17} />}
      id="order-parts-title"
      title="Repuestos"
    >
      <div className="space-y-4 p-4">
        {order.state === 'REOPENED' && (
          <InlineNotice title="Reapertura por corrección" tone="info">
            El trabajo correctivo no genera cobro: no se agregan repuestos a una
            venta. La reposición por corrección es una operación futura del
            Administrador.
          </InlineNotice>
        )}
        {query.isPending && <LoadingState label="Cargando repuestos…" />}
        {query.isError && (
          <InlineNotice
            title="No se pudieron cargar los repuestos"
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
        {query.isSuccess && sales.length === 0 && (
          <p className="text-body text-ink-muted">
            Sin repuestos registrados en esta orden.
          </p>
        )}
        {draft && draft.lines.length > 0 && (
          <DraftSale
            canManage={canManage}
            canOpenSales={canOpenSales}
            onEdit={(line, target) => {
              returnFocus.current = target
              setEditing({ line })
            }}
            onRemove={(line, target) => {
              returnFocus.current = target
              setRemoveError('')
              setRemoving(line)
            }}
            sale={draft}
          />
        )}
        {confirmed.map((sale) => (
          <ConfirmedSale
            canOpenSales={canOpenSales}
            canSeeKardex={canSeeKardex}
            key={sale.id}
            sale={sale}
          />
        ))}
      </div>
      {editing && (
        <PartDialog
          line={editing.line}
          onClose={() => setEditing(null)}
          onDone={onDone}
          order={order}
          returnFocusRef={returnFocus}
        />
      )}
      <ConfirmationPanel
        confirmLabel="Retirar repuesto"
        description={
          removing
            ? `Se retirará «${removing.product_name ?? ''}» de la venta pendiente y se liberará su reserva. No hay movimiento de inventario.`
            : ''
        }
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && void remove(removing)}
        open={removing !== null}
        returnFocusRef={returnFocus}
        title="Retirar repuesto"
        tone="danger"
      >
        {removeError && (
          <InlineNotice title="No se retiró el repuesto" tone="danger">
            {removeError}
          </InlineNotice>
        )}
      </ConfirmationPanel>
    </SectionPanel>
  )
}

function DraftSale({
  sale,
  canManage,
  canOpenSales,
  onEdit,
  onRemove,
}: {
  sale: LinkedSale
  canManage: boolean
  canOpenSales: boolean
  onEdit: (line: DraftLine, target: HTMLElement) => void
  onRemove: (line: DraftLine, target: HTMLElement) => void
}) {
  const estimate = new Map(
    (sale.estimate?.lines ?? []).map((line) => [line.position, line]),
  )
  return (
    <div className="rounded-control border border-dashed border-line-strong p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <StatusBadge label="Reservado, pendiente de confirmar" tone="warning" />
        {canOpenSales && (
          <Link className="text-body hover:underline" to={`/sales/${sale.id}`}>
            Abrir venta pendiente
          </Link>
        )}
      </div>
      <p className="mb-2 text-label text-ink-muted">
        Reserva la disponibilidad sin descontar inventario ni generar deuda. La
        salida ocurre cuando el Vendedor o el Administrador confirma la venta;
        la orden no puede finalizar mientras haya repuestos pendientes.
      </p>
      <PartTable
        actions={
          canManage
            ? (line) => (
                <>
                  <IconButton
                    icon={<NotePencil size={16} />}
                    label={`Cambiar cantidad de ${line.product_name ?? ''}`}
                    onClick={(event) => onEdit(line, event.currentTarget)}
                  />
                  <IconButton
                    icon={<Trash size={16} />}
                    label={`Retirar ${line.product_name ?? ''}`}
                    onClick={(event) => onRemove(line, event.currentTarget)}
                  />
                </>
              )
            : undefined
        }
        amounts={(line) => estimate.get(line.position)}
        lines={sale.lines}
      />
      {sale.estimate?.totals && (
        <p className="mt-2 flex justify-end gap-3 text-body">
          <span className="text-ink-muted">
            Total estimado (precios vigentes)
          </span>
          <Money
            amount={sale.estimate.totals.total}
            className="font-semibold"
          />
        </p>
      )}
    </div>
  )
}

function ConfirmedSale({
  sale,
  canOpenSales,
  canSeeKardex,
}: {
  sale: LinkedSale
  canOpenSales: boolean
  canSeeKardex: boolean
}) {
  return (
    <div className="rounded-control border border-line p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="code text-body font-semibold">
          {sale.internal_number}
        </span>
        <StatusBadge
          label={
            sale.state === 'VOIDED'
              ? 'Anulada'
              : 'Confirmada: salida registrada'
          }
          tone={sale.state === 'VOIDED' ? 'neutral' : 'success'}
        />
        {canOpenSales && (
          <Link className="text-body hover:underline" to={`/sales/${sale.id}`}>
            Ver venta y movimientos
          </Link>
        )}
      </div>
      <p className="mb-2 text-label text-ink-muted">
        Venta confirmada: sus líneas no se modifican desde la orden. Una
        corrección requiere el procedimiento comercial correspondiente.
      </p>
      <PartTable
        amounts={(line) => line}
        kardex={canSeeKardex && sale.state === 'CONFIRMED'}
        lines={sale.lines}
      />
    </div>
  )
}

function PartTable({
  lines,
  amounts,
  actions,
  kardex = false,
}: {
  kardex?: boolean
  lines: DraftLine[]
  amounts: (line: DraftLine) =>
    | {
        unit_price?: string | null
        tax_amount?: string | null
        total_amount?: string | null
      }
    | undefined
  actions?: ((line: DraftLine) => React.ReactNode) | undefined
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body">
        <thead>
          <tr className="border-b border-line text-left text-label text-ink-muted">
            <th className="py-2 pr-3 font-semibold">Repuesto</th>
            <th className="py-2 pr-3 text-right font-semibold">Cant.</th>
            <th className="py-2 pr-3 text-right font-semibold">Precio final</th>
            <th className="py-2 pr-3 text-right font-semibold">Impuesto</th>
            <th className="py-2 pr-3 text-right font-semibold">Total</th>
            {actions && (
              <th className="py-2 font-semibold">
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const values = amounts(line)
            return (
              <tr className="border-b border-line last:border-0" key={line.id}>
                <td className="py-2 pr-3">
                  {kardex ? (
                    <Link
                      aria-label={`Kardex de ${line.product_name ?? ''}`}
                      className="code text-label hover:underline"
                      to={`/inventory/products/${line.product_id}/kardex`}
                    >
                      {line.product_code}
                    </Link>
                  ) : (
                    <span className="code text-label text-ink-muted">
                      {line.product_code}
                    </span>
                  )}{' '}
                  <span className="font-medium text-ink">
                    {line.product_name}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right">{line.quantity}</td>
                <td className="py-2 pr-3 text-right">
                  <Money amount={values?.unit_price ?? null} />
                </td>
                <td className="py-2 pr-3 text-right">
                  <Money amount={values?.tax_amount ?? null} />
                </td>
                <td className="py-2 pr-3 text-right font-medium">
                  <Money amount={values?.total_amount ?? null} />
                </td>
                {actions && (
                  <td className="py-1 text-right whitespace-nowrap">
                    {actions(line)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PartDialog({
  order,
  line,
  onClose,
  onDone,
  returnFocusRef,
}: {
  order: MaintenanceOrder
  line: DraftLine | null
  onClose: () => void
  onDone: (message: string) => void
  returnFocusRef: React.RefObject<HTMLElement | null>
}) {
  const mutations = useBillingMutations()
  const tracker = useIntentTracker()
  const useOptions = useMemo(() => makePartOptions(order.id), [order.id])
  const [product, setProduct] = useState<ComboboxOption | null>(null)
  const [quantity, setQuantity] = useState(
    line ? String(Number(line.quantity)) : '1',
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function save(): Promise<boolean> {
    const next: Record<string, string> = {}
    if (!line && !product)
      next.product_id = 'Seleccione un repuesto del catálogo.'
    if (!/^\d+$/.test(quantity) || Number(quantity) < 1)
      next.quantity = 'La cantidad debe ser un entero positivo.'
    setErrors(next)
    if (Object.keys(next).length) return false
    try {
      if (line) {
        await tracker.run({ changePart: line.id, quantity }, (key) =>
          mutations.changePart.mutateAsync({
            id: order.id,
            lineId: line.id,
            quantity,
            expectedVersion: order.version,
            key,
          }),
        )
        onDone(`Cantidad de «${line.product_name ?? ''}» actualizada.`)
      } else if (product) {
        await tracker.run({ addPart: product.id, quantity }, (key) =>
          mutations.addPart.mutateAsync({
            id: order.id,
            productId: product.id,
            quantity,
            expectedVersion: order.version,
            key,
          }),
        )
        onDone(
          `Repuesto «${product.label}» reservado; se descontará al confirmar la venta.`,
        )
      }
      return true
    } catch (error) {
      const problem = describeProblem(error)
      setErrors(problem.fields)
      throw new Error(problem.message, { cause: error })
    }
  }

  return (
    <FormModal
      description="Agregar reserva disponibilidad; no descuenta inventario ni genera deuda. El precio es el del catálogo, sin descuentos."
      dirty={
        Boolean(product) ||
        quantity !== (line ? String(Number(line.quantity)) : '1')
      }
      onClose={onClose}
      onSave={save}
      open
      returnFocusRef={returnFocusRef}
      saveLabel={line ? 'Guardar cantidad' : 'Reservar repuesto'}
      size="wide"
      title={line ? `Cambiar ${line.product_name ?? ''}` : 'Agregar repuesto'}
    >
      <div className="space-y-4">
        {!line && (
          <div className="ui-field">
            <label
              className="block text-label font-semibold text-ink"
              htmlFor="part-product"
            >
              Repuesto del catálogo
            </label>
            <div className="mt-1.5">
              <Combobox
                error={errors.product_id}
                id="part-product"
                inactiveHelp="Producto inactivo: no puede agregarse."
                label="Repuesto del catálogo"
                onSelect={setProduct}
                placeholder="Buscar por código o nombre"
                selected={product}
                useOptions={useOptions}
              />
            </div>
            {product?.detail && (
              <p
                aria-live="polite"
                className="mt-2 rounded-control border border-line bg-surface-subtle px-3 py-2 text-label text-ink-muted"
              >
                {product.detail}. La disponibilidad es informativa; se valida al
                reservar y al confirmar.
              </p>
            )}
          </div>
        )}
        <Field
          error={errors.quantity}
          hint="Presentaciones completas."
          id="part-quantity"
          label="Cantidad"
          required
        >
          <Input
            id="part-quantity"
            inputMode="numeric"
            onChange={(event) => setQuantity(event.target.value)}
            value={quantity}
          />
        </Field>
      </div>
    </FormModal>
  )
}
