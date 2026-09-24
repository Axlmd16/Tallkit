import { Wrench } from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import {
  Button,
  ButtonGroup,
  Checkbox,
  Combobox,
  Field,
  FormLayout,
  FormSection,
  InlineNotice,
  Input,
  PlateTag,
  Select,
  Textarea,
  type ComboboxOption,
} from '@/shared/ui'

import { kilometers } from './format'
import { useCustomerPickerOptions, useVehicleOptions } from './hooks'
import type { MaintenanceOrder, OdometerWarning, OrderInput } from './types'

/** Fecha actual del negocio (America/Guayaquil) en formato AAAA-MM-DD. */
export function businessToday(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Guayaquil',
  })
}

export interface OrderFormValues {
  customer: ComboboxOption | null
  vehicleId: number | null
  openedOn: string
  odometer: string
  diagnosis: string
  notes: string
}

export function initialValues(
  order?: MaintenanceOrder,
  defaults: {
    customer?: ComboboxOption | null
    vehicleId?: number | null
  } = {},
): OrderFormValues {
  if (order) {
    return {
      customer: { id: order.customer.id, label: order.customer.name },
      vehicleId: order.vehicle.id,
      openedOn: order.opened_on,
      odometer: String(order.odometer_km),
      diagnosis: order.diagnosis,
      notes: order.notes,
    }
  }
  return {
    customer: defaults.customer ?? null,
    vehicleId: defaults.vehicleId ?? null,
    openedOn: businessToday(),
    odometer: '',
    diagnosis: '',
    notes: '',
  }
}

export interface OrderFormProps {
  order?: MaintenanceOrder | undefined
  values: OrderFormValues
  onChange: (values: OrderFormValues) => void
  onSubmit: (data: OrderInput) => Promise<void>
  onCancel: () => void
  fieldErrors: Record<string, string>
  odometerWarning: OdometerWarning | null
  pending: boolean
}

/**
 * Datos operativos de la orden. Los vehículos se limitan a los del propietario vigente;
 * un kilometraje menor al último conocido exige confirmación explícita, sin prohibirlo.
 */
export function OrderForm({
  order,
  values,
  onChange,
  onSubmit,
  onCancel,
  fieldErrors,
  odometerWarning,
  pending,
}: OrderFormProps) {
  const [confirmed, setConfirmed] = useState(false)
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const vehicles = useVehicleOptions(values.customer?.id ?? null)
  const options = vehicles.data?.results ?? []
  const selected = options.find((v) => v.id === values.vehicleId)
  const openElsewhere =
    selected?.open_order && selected.open_order.id !== order?.id
      ? selected.open_order
      : null
  const errors = { ...fieldErrors, ...localErrors }
  const set = (patch: Partial<OrderFormValues>) =>
    onChange({ ...values, ...patch })

  async function submit(event: FormEvent) {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!values.customer) next.customer_id = 'Seleccione un cliente.'
    if (!values.vehicleId) next.vehicle_id = 'Seleccione un vehículo.'
    if (!/^\d+$/.test(values.odometer.trim()))
      next.odometer_km = 'Ingrese el kilometraje en kilómetros enteros.'
    if (!values.openedOn) next.opened_on = 'Ingrese la fecha de apertura.'
    else if (values.openedOn > businessToday())
      next.opened_on = 'La fecha de apertura no puede ser futura.'
    setLocalErrors(next)
    if (Object.keys(next).length || !values.customer || !values.vehicleId)
      return
    await onSubmit({
      customer_id: values.customer.id,
      vehicle_id: values.vehicleId,
      opened_on: values.openedOn,
      odometer_km: Number(values.odometer.trim()),
      diagnosis: values.diagnosis,
      notes: values.notes,
      ...(odometerWarning && confirmed ? { odometer_confirmed: true } : {}),
    })
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)}>
      <FormLayout
        actions={
          <ButtonGroup label="Acciones de la orden">
            <Button onClick={onCancel} type="button" variant="secondary">
              Cancelar
            </Button>
            <Button disabled={pending || Boolean(openElsewhere)} type="submit">
              {pending
                ? 'Guardando…'
                : order
                  ? 'Guardar cambios'
                  : 'Registrar orden'}
            </Button>
          </ButtonGroup>
        }
        columns={2}
      >
        <FormSection
          className="sm:col-span-2"
          description="El vehículo debe pertenecer actualmente al cliente. Registrar la orden no cambia la propiedad."
          icon={<Wrench aria-hidden="true" size={18} />}
          title="Cliente y vehículo"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="ui-field">
              <label
                className="block text-xs font-semibold text-ink after:ml-0.5 after:text-danger after:content-['*']"
                htmlFor="order-customer"
              >
                Cliente
              </label>
              <div className="mt-1.5">
                <Combobox
                  clearable
                  error={errors.customer_id}
                  id="order-customer"
                  inactiveHelp="El cliente está inactivo: no puede iniciar una orden."
                  label="Cliente"
                  onSelect={(customer) => set({ customer, vehicleId: null })}
                  placeholder="Nombre o identificación"
                  selected={values.customer}
                  useOptions={useCustomerPickerOptions}
                />
              </div>
            </div>
            <Field
              error={errors.vehicle_id}
              hint={
                values.customer && vehicles.data && options.length === 0
                  ? 'El cliente no tiene vehículos activos a su nombre.'
                  : undefined
              }
              id="order-vehicle"
              label="Vehículo"
              required
            >
              <Select
                disabled={!values.customer || vehicles.isPending}
                id="order-vehicle"
                onChange={(event) =>
                  set({
                    vehicleId: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
                value={values.vehicleId ?? ''}
              >
                <option value="">
                  {values.customer
                    ? 'Seleccione un vehículo'
                    : 'Primero seleccione un cliente'}
                </option>
                {options.map((v) => (
                  <option key={v.id} value={v.id}>
                    {`${v.plate} · ${v.brand} ${v.model}${v.year ? ` ${v.year}` : ''}`}
                  </option>
                ))}
                {order &&
                  values.vehicleId === order.vehicle.id &&
                  !selected && (
                    <option value={order.vehicle.id}>
                      {`${order.vehicle.plate} · ${order.vehicle.brand} ${order.vehicle.model}`}
                    </option>
                  )}
              </Select>
            </Field>
          </div>
          {selected && (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-muted">
              <PlateTag plate={selected.plate} />
              {selected.brand} {selected.model}
              {selected.color ? ` · ${selected.color}` : ''}
            </p>
          )}
          {openElsewhere && (
            <div className="mt-3">
              <InlineNotice
                title="El vehículo ya tiene una orden abierta"
                tone="warning"
              >
                Finalice la orden{' '}
                <Link
                  className="font-semibold underline"
                  to={`/maintenance/${openElsewhere.id}`}
                >
                  {openElsewhere.number}
                </Link>{' '}
                antes de abrir otra para este vehículo.
              </InlineNotice>
            </div>
          )}
        </FormSection>
        <Field
          error={errors.opened_on}
          id="order-opened-on"
          label="Fecha de apertura"
          required
        >
          <Input
            id="order-opened-on"
            max={businessToday()}
            onChange={(event) => set({ openedOn: event.target.value })}
            type="date"
            value={values.openedOn}
          />
        </Field>
        <Field
          error={errors.odometer_km}
          hint="Kilómetros enteros registrados al ingreso del vehículo."
          id="order-odometer"
          label="Kilometraje (km)"
          required
        >
          <Input
            id="order-odometer"
            inputMode="numeric"
            onChange={(event) => {
              setConfirmed(false)
              set({ odometer: event.target.value })
            }}
            value={values.odometer}
          />
        </Field>
        {odometerWarning && (
          <div className="sm:col-span-2">
            <InlineNotice
              title="Kilometraje menor al último conocido"
              tone="warning"
            >
              <p>
                La orden {odometerWarning.order_number} registró{' '}
                {kilometers(odometerWarning.last_known_km)}. Si el valor
                ingresado es correcto (por ejemplo, cambio de tablero),
                confírmelo para guardar.
              </p>
              <div className="mt-2">
                <Checkbox
                  checked={confirmed}
                  label="Confirmo que el kilometraje ingresado es correcto"
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
              </div>
            </InlineNotice>
          </div>
        )}
        <Field
          className="sm:col-span-2"
          error={errors.diagnosis}
          hint="Puede completarse después; es obligatorio para finalizar."
          id="order-diagnosis"
          label="Diagnóstico"
        >
          <Textarea
            id="order-diagnosis"
            maxLength={5000}
            onChange={(event) => set({ diagnosis: event.target.value })}
            rows={4}
            value={values.diagnosis}
          />
        </Field>
        <Field
          className="sm:col-span-2"
          error={errors.notes}
          hint="Incluya aquí, si corresponde, los repuestos aportados por el cliente."
          id="order-notes"
          label="Observaciones"
        >
          <Textarea
            id="order-notes"
            maxLength={5000}
            onChange={(event) => set({ notes: event.target.value })}
            rows={3}
            value={values.notes}
          />
        </Field>
      </FormLayout>
    </form>
  )
}
