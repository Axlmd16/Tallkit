import { NotePencil, Plus, Toolbox, Trash } from '@phosphor-icons/react'
import { useRef, useState } from 'react'

import { describeProblem } from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  Combobox,
  ConfirmationPanel,
  Field,
  FormModal,
  IconButton,
  InlineNotice,
  Input,
  Money,
  StatusBadge,
  type ComboboxOption,
} from '@/shared/ui'

import { SectionPanel } from './SectionPanel'
import { useMaintenanceMutations, useServicePickerOptions } from './hooks'
import type { Intervention, MaintenanceOrder, ServiceLine } from './types'

const PRICE = /^\d{1,12}(\.\d{1,2})?$/

type Editing = { line: ServiceLine | null } | null

/**
 * Servicios de una intervención. Los precios son los aplicados a esta orden; en una
 * intervención correctiva se registran sin cargo. Solo la intervención abierta es editable.
 */
export function ServiceLinesSection({
  order,
  onDone,
}: {
  order: MaintenanceOrder
  onDone: (message: string) => void
}) {
  const canManage = order.allowed_actions.includes('manage_services')
  const canChangePrice = order.allowed_actions.includes('change_price')
  const [editing, setEditing] = useState<Editing>(null)
  const [removing, setRemoving] = useState<ServiceLine | null>(null)
  const [removeError, setRemoveError] = useState('')
  const returnFocus = useRef<HTMLElement | null>(null)
  const mutations = useMaintenanceMutations()
  const tracker = useIntentTracker()
  const open = order.interventions.find((i) => i.is_open) ?? null

  async function remove(line: ServiceLine) {
    setRemoveError('')
    try {
      await tracker.run({ remove: line.id }, (key) =>
        mutations.removeLine.mutateAsync({
          id: order.id,
          lineId: line.id,
          expectedVersion: order.version,
          key,
        }),
      )
      setRemoving(null)
      onDone(`Servicio «${line.service_name}» retirado de la orden.`)
    } catch (error) {
      setRemoveError(describeProblem(error).message)
    }
  }

  return (
    <SectionPanel
      actions={
        canManage &&
        open && (
          <Button
            onClick={(event) => {
              returnFocus.current = event.currentTarget
              setEditing({ line: null })
            }}
            type="button"
            variant="soft"
          >
            <Plus aria-hidden="true" size={16} />
            {open.kind === 'CORRECTIVE'
              ? 'Agregar servicio sin cargo'
              : 'Agregar servicio'}
          </Button>
        )
      }
      description="Precios aplicados a esta orden; el catálogo no cambia."
      icon={<Toolbox size={17} />}
      id="order-services-title"
      title="Servicios"
    >
      <div className="space-y-4 p-4">
        {order.interventions.map((intervention) => (
          <InterventionLines
            canManage={canManage && intervention.is_open}
            intervention={intervention}
            key={intervention.id}
            onEdit={(line, target) => {
              returnFocus.current = target
              setEditing({ line })
            }}
            onRemove={(line, target) => {
              returnFocus.current = target
              setRemoveError('')
              setRemoving(line)
            }}
          />
        ))}
        <div className="flex items-center justify-end gap-3 border-t border-line pt-3">
          <span className="text-[13px] font-semibold text-ink">
            Total de servicios de la orden
          </span>
          <Money
            amount={order.services_total}
            className="text-[15px] font-semibold"
          />
        </div>
      </div>
      {editing && open && (
        <ServiceLineDialog
          canChangePrice={canChangePrice}
          intervention={open}
          line={editing.line}
          onClose={() => setEditing(null)}
          onDone={onDone}
          order={order}
          returnFocusRef={returnFocus}
        />
      )}
      <ConfirmationPanel
        confirmLabel="Retirar servicio"
        description={
          removing
            ? `Se retirará «${removing.service_name}» de esta orden y se recalculará el total.`
            : ''
        }
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && void remove(removing)}
        open={removing !== null}
        returnFocusRef={returnFocus}
        title="Retirar servicio"
        tone="danger"
      >
        {removeError && (
          <InlineNotice title="No se retiró el servicio" tone="danger">
            {removeError}
          </InlineNotice>
        )}
      </ConfirmationPanel>
    </SectionPanel>
  )
}

function InterventionLines({
  intervention,
  canManage,
  onEdit,
  onRemove,
}: {
  intervention: Intervention
  canManage: boolean
  onEdit: (line: ServiceLine, target: HTMLElement) => void
  onRemove: (line: ServiceLine, target: HTMLElement) => void
}) {
  const corrective = intervention.kind === 'CORRECTIVE'
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-semibold text-ink">
        {corrective
          ? `Intervención correctiva ${intervention.ordinal - 1} · sin cargo`
          : 'Intervención inicial'}
      </h3>
      {intervention.lines.length === 0 ? (
        <p className="text-[13px] text-ink-muted">Sin servicios registrados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="py-2 pr-3 font-semibold">Servicio</th>
                <th className="py-2 pr-3 text-right font-semibold">
                  Precio referencial
                </th>
                <th className="py-2 pr-3 text-right font-semibold">
                  Precio aplicado
                </th>
                <th className="py-2 pr-3 text-right font-semibold">Cant.</th>
                <th className="py-2 pr-3 text-right font-semibold">Subtotal</th>
                {canManage && (
                  <th className="py-2 font-semibold">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {intervention.lines.map((line) => (
                <tr
                  className="border-b border-line last:border-0"
                  key={line.id}
                >
                  <td className="py-2 pr-3">
                    <span className="font-medium text-ink">
                      {line.service_name}
                    </span>
                    {!line.service_is_active && (
                      <StatusBadge
                        className="ml-2"
                        label="Inactivo en catálogo"
                        tone="neutral"
                      />
                    )}
                    {line.no_charge && (
                      <StatusBadge
                        className="ml-2"
                        label="Sin cargo"
                        tone="info"
                      />
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right text-ink-muted">
                    <Money amount={line.reference_price} />
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <Money amount={line.applied_price} />
                  </td>
                  <td className="py-2 pr-3 text-right">{line.quantity}</td>
                  <td className="py-2 pr-3 text-right font-medium">
                    <Money amount={line.subtotal} />
                  </td>
                  {canManage && (
                    <td className="py-1 text-right whitespace-nowrap">
                      <IconButton
                        icon={<NotePencil size={16} />}
                        label={`Editar ${line.service_name}`}
                        onClick={(event) => onEdit(line, event.currentTarget)}
                      />
                      <IconButton
                        icon={<Trash size={16} />}
                        label={`Retirar ${line.service_name}`}
                        onClick={(event) => onRemove(line, event.currentTarget)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ServiceLineDialog({
  order,
  intervention,
  line,
  canChangePrice,
  onClose,
  onDone,
  returnFocusRef,
}: {
  order: MaintenanceOrder
  intervention: Intervention
  line: ServiceLine | null
  canChangePrice: boolean
  onClose: () => void
  onDone: (message: string) => void
  returnFocusRef: React.RefObject<HTMLElement | null>
}) {
  const corrective = intervention.kind === 'CORRECTIVE'
  const mutations = useMaintenanceMutations()
  const tracker = useIntentTracker()
  const [service, setService] = useState<ComboboxOption | null>(null)
  const [reference, setReference] = useState(line?.reference_price ?? '')
  const [quantity, setQuantity] = useState(String(line?.quantity ?? 1))
  const [price, setPrice] = useState(line?.applied_price ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const priceEditable = canChangePrice && !corrective

  async function save(): Promise<boolean> {
    const next: Record<string, string> = {}
    if (!line && !service)
      next.service_id = 'Seleccione un servicio del catálogo.'
    if (
      !/^\d+$/.test(quantity) ||
      Number(quantity) < 1 ||
      Number(quantity) > 9999
    )
      next.quantity = 'La cantidad debe ser un entero entre 1 y 9999.'
    if (priceEditable && price !== '' && !PRICE.test(price))
      next.applied_price = 'Ingrese un importe en USD con hasta dos decimales.'
    setErrors(next)
    if (Object.keys(next).length) return false
    const data = {
      quantity: Number(quantity),
      ...(priceEditable && price !== '' ? { applied_price: price } : {}),
    }
    try {
      if (line) {
        await tracker.run({ line: line.id, ...data }, (key) =>
          mutations.updateLine.mutateAsync({
            id: order.id,
            lineId: line.id,
            data,
            expectedVersion: order.version,
            key,
          }),
        )
        onDone(`Servicio «${line.service_name}» actualizado.`)
      } else if (service) {
        const payload = { service_id: service.id, ...data }
        await tracker.run(payload, (key) =>
          mutations.addLine.mutateAsync({
            id: order.id,
            data: payload,
            expectedVersion: order.version,
            key,
          }),
        )
        onDone(`Servicio «${service.label}» agregado a la orden.`)
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
      description={
        corrective
          ? 'Intervención correctiva: el servicio se registra sin cargo al cliente.'
          : 'El precio referencial del catálogo es el valor inicial; el aplicado vale solo para esta orden.'
      }
      dirty={Boolean(service) || quantity !== String(line?.quantity ?? 1)}
      onClose={onClose}
      onSave={save}
      open
      returnFocusRef={returnFocusRef}
      saveLabel={line ? 'Guardar servicio' : 'Agregar servicio'}
      size="wide"
      title={line ? `Editar ${line.service_name}` : 'Agregar servicio'}
    >
      <div className="space-y-4">
        {!line && (
          <div className="ui-field">
            <label
              className="block text-xs font-semibold text-ink"
              htmlFor="line-service"
            >
              Servicio del catálogo
            </label>
            <div className="mt-1.5">
              <Combobox
                error={errors.service_id}
                id="line-service"
                inactiveHelp="Servicio inactivo: no puede agregarse."
                label="Servicio del catálogo"
                onSelect={(option) => {
                  setService(option)
                  const match = option?.detail?.match(/USD ([\d.]+)/)
                  setReference(match?.[1] ?? '')
                  setPrice(match?.[1] ?? '')
                }}
                placeholder="Buscar servicio activo"
                selected={service}
                useOptions={useServicePickerOptions}
              />
            </div>
            {service && (
              <div
                aria-live="polite"
                className="mt-2 rounded-control border border-line bg-surface-subtle px-3 py-2 text-[13px]"
              >
                <p className="font-semibold break-words text-ink">
                  {service.label}
                </p>
                {reference && (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Precio referencial del catálogo: USD {reference}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            error={errors.quantity}
            id="line-quantity"
            label="Cantidad"
            required
          >
            <Input
              id="line-quantity"
              inputMode="numeric"
              onChange={(event) => setQuantity(event.target.value)}
              value={quantity}
            />
          </Field>
          <Field
            error={errors.applied_price}
            hint={
              corrective
                ? 'Sin cargo por corrección atribuible al taller.'
                : line && reference
                  ? `Referencial del catálogo: USD ${reference}`
                  : undefined
            }
            id="line-price"
            label="Precio aplicado a esta orden (USD)"
          >
            <Input
              disabled={!priceEditable}
              id="line-price"
              inputMode="decimal"
              onChange={(event) => setPrice(event.target.value)}
              value={corrective ? '0.00' : price}
            />
          </Field>
        </div>
      </div>
    </FormModal>
  )
}
