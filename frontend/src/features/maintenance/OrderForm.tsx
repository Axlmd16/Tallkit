import {
  CalendarBlank,
  Car,
  ClipboardText,
  FloppyDisk,
  Gauge,
  Stethoscope,
  UserCircle,
} from '@phosphor-icons/react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import {
  Button,
  Checkbox,
  Combobox,
  type ComboboxOption,
  Field,
  InlineNotice,
  Input,
  LeadingIcon,
  PlateTag,
  SectionPanel,
  Select,
  Textarea,
} from '@/shared/ui'

import { documentDate, kilometers } from './format'
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
  const vehicleSummary = selected
    ? {
        plate: selected.plate,
        description: [
          `${selected.brand} ${selected.model}`,
          selected.year,
          selected.color,
        ]
          .filter(Boolean)
          .join(' · '),
      }
    : order && values.vehicleId === order.vehicle.id
      ? {
          plate: order.vehicle.plate,
          description: `${order.vehicle.brand} ${order.vehicle.model}`,
        }
      : null
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
    <form
      className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <div className="min-w-0 space-y-4">
        <SectionPanel
          description="El vehículo debe pertenecer actualmente al cliente. Registrar la orden no cambia la propiedad."
          icon={<UserCircle size={17} />}
          id="order-form-parties"
          title="Cliente y vehículo"
        >
          <div className="space-y-4 p-4">
            <div className="ui-field">
              <label
                className="block text-label font-semibold text-ink after:ml-0.5 after:text-danger after:content-['*']"
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
                  placeholder="Buscar por nombre, razón social o identificación"
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
                  : 'Solo se listan los vehículos activos del cliente seleccionado.'
              }
              id="order-vehicle"
              label="Vehículo"
              required
            >
              <LeadingIcon icon={<Car size={17} />}>
                <Select
                  className="pl-10"
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
              </LeadingIcon>
            </Field>
            {openElsewhere && (
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
            )}
          </div>
        </SectionPanel>

        <SectionPanel
          description="Datos registrados al recibir el vehículo en el taller."
          icon={<Gauge size={17} />}
          id="order-form-intake"
          title="Ingreso del vehículo"
        >
          <div className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-[13rem_13rem]">
              <Field
                error={errors.opened_on}
                id="order-opened-on"
                label="Fecha de apertura"
                required
              >
                <LeadingIcon icon={<CalendarBlank size={17} />}>
                  <Input
                    className="pl-10"
                    id="order-opened-on"
                    max={businessToday()}
                    onChange={(event) => set({ openedOn: event.target.value })}
                    type="date"
                    value={values.openedOn}
                  />
                </LeadingIcon>
              </Field>
              <Field
                error={errors.odometer_km}
                id="order-odometer"
                label="Kilometraje (km)"
                required
              >
                <LeadingIcon icon={<Gauge size={17} />}>
                  <Input
                    className="pr-11 pl-10 text-right"
                    id="order-odometer"
                    inputMode="numeric"
                    onChange={(event) => {
                      setConfirmed(false)
                      set({ odometer: event.target.value })
                    }}
                    placeholder="0"
                    value={values.odometer}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-label font-semibold text-ink-muted"
                  >
                    km
                  </span>
                </LeadingIcon>
              </Field>
            </div>
            {odometerWarning && (
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
            )}
          </div>
        </SectionPanel>

        <SectionPanel
          description="Pueden completarse después; el diagnóstico es obligatorio para finalizar."
          icon={<Stethoscope size={17} />}
          id="order-form-diagnosis"
          title="Diagnóstico y observaciones"
        >
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            <Field
              error={errors.diagnosis}
              id="order-diagnosis"
              label="Diagnóstico"
            >
              <Textarea
                id="order-diagnosis"
                maxLength={5000}
                onChange={(event) => set({ diagnosis: event.target.value })}
                rows={5}
                value={values.diagnosis}
              />
            </Field>
            <Field
              error={errors.notes}
              hint="Incluya aquí, si corresponde, los repuestos aportados por el cliente."
              id="order-notes"
              label="Observaciones"
            >
              <Textarea
                id="order-notes"
                maxLength={5000}
                onChange={(event) => set({ notes: event.target.value })}
                rows={5}
                value={values.notes}
              />
            </Field>
          </div>
        </SectionPanel>
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <SectionPanel
          icon={<ClipboardText size={17} />}
          id="order-form-summary"
          title={order ? `Orden ${order.number}` : 'Resumen de la orden'}
        >
          <dl className="space-y-3 p-4 text-body">
            <div>
              <dt className="text-label text-ink-muted">Cliente</dt>
              <dd className="mt-0.5 font-medium break-words text-ink">
                {values.customer?.label ?? (
                  <span className="font-normal text-ink-muted">
                    Sin seleccionar
                  </span>
                )}
                {values.customer?.detail && (
                  <span className="block text-label font-normal text-ink-muted">
                    {values.customer.detail}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-label text-ink-muted">Vehículo</dt>
              <dd className="mt-0.5">
                {vehicleSummary ? (
                  <>
                    <PlateTag plate={vehicleSummary.plate} />
                    <span className="mt-1 block text-label text-ink-muted">
                      {vehicleSummary.description}
                    </span>
                  </>
                ) : (
                  <span className="text-ink-muted">Sin seleccionar</span>
                )}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-label text-ink-muted">Apertura</dt>
                <dd className="mt-0.5 text-ink">
                  {values.openedOn ? documentDate(values.openedOn) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-label text-ink-muted">Kilometraje</dt>
                <dd className="mt-0.5 text-ink">
                  {/^\d+$/.test(values.odometer.trim())
                    ? kilometers(Number(values.odometer.trim()))
                    : '—'}
                </dd>
              </div>
            </div>
            {!order && (
              <p className="rounded-control bg-surface-subtle px-3 py-2 text-label text-ink-muted">
                El número ART-OT se asigna al registrar. Servicios y fotografías
                se agregan después, desde la ficha.
              </p>
            )}
          </dl>
          <div className="flex flex-col gap-2 border-t border-line p-4">
            <Button disabled={pending || Boolean(openElsewhere)} type="submit">
              <FloppyDisk aria-hidden="true" size={16} />
              {pending
                ? 'Guardando…'
                : order
                  ? 'Guardar cambios'
                  : 'Registrar orden'}
            </Button>
            <Button onClick={onCancel} type="button" variant="secondary">
              Cancelar
            </Button>
          </div>
        </SectionPanel>
      </aside>
    </form>
  )
}
