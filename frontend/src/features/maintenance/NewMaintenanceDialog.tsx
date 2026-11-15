import { Car, MagnifyingGlass, Wrench } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { useSession } from '@/features/auth/hooks'
import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import { useArtisanReceivables } from '@/features/maintenance/billingHooks'
import { useReceivables } from '@/features/sales/hooks'
import { useVehicles } from '@/features/vehicles/hooks'
import type { VehicleSummary } from '@/features/vehicles/types'
import { useBusinessName } from '@/shared/api/entity-logos'
import { useIntentTracker } from '@/shared/api/idempotency'
import {
  Button,
  Checkbox,
  GaugeMotif,
  InlineNotice,
  Modal,
  Money,
  PlateTag,
  useToast,
} from '@/shared/ui'

import { businessToday } from './OrderForm'
import { documentDate, kilometers } from './format'
import {
  useMaintenanceMutations,
  useMaintenanceOrders,
  useVehicleOptions,
} from './hooks'
import { odometerWarningOf } from './odometer'
import { requestNotes } from './request'
import type { OdometerWarning } from './types'

/** Lo más habitual que pide un cliente; el texto elegido pasa a las observaciones de la orden. */
export const REQUEST_CHIPS = [
  'Cambio de aceite',
  'Frenos',
  'Revisión general',
  'Alineación',
  'Ruido extraño',
  'Otro',
] as const

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function vehicleLabel(vehicle: VehicleSummary): string {
  return [`${vehicle.brand.name} ${vehicle.model}`, vehicle.year, vehicle.color]
    .filter(Boolean)
    .join(' · ')
}

function DebtPill({
  scope,
  amount,
}: {
  scope: 'commercial' | 'artesanal'
  amount: string
}) {
  const name = useBusinessName(scope)
  return (
    <span className="inline-flex items-center gap-2 self-start rounded-full bg-danger-soft px-3 py-1 text-label font-semibold text-danger">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      Este cliente debe <Money amount={amount} /> en {name}
    </span>
  )
}

/**
 * Deuda del cliente en cada negocio que la sesión puede ver. Son dos RUC distintos: se avisa
 * por separado y nunca se suma.
 */
function CustomerDebt({ customerId }: { customerId: number }) {
  const permissions = new Set(useSession().data?.permissions ?? [])
  const canCommercial = permissions.has('pagos_comerciales.ver')
  const canArtisan = permissions.has('pagos_artesanales.ver')
  const sales = useReceivables(
    { customerId, onlyDebt: true, pageSize: 1 },
    canCommercial,
  )
  const services = useArtisanReceivables(
    { customerId, pageSize: 1 },
    canArtisan,
  )
  const commercial = sales.data?.receivable_total
  const artisan = services.data?.totals.balance
  return (
    <>
      {commercial && Number(commercial) > 0 && (
        <DebtPill amount={commercial} scope="commercial" />
      )}
      {artisan && Number(artisan) > 0 && (
        <DebtPill amount={artisan} scope="artesanal" />
      )}
    </>
  )
}

function ArrivalCard({
  vehicle,
  lastKm,
  lastVisit,
}: {
  vehicle: VehicleSummary
  lastKm: number | null
  lastVisit: string | null
}) {
  return (
    <div className="relative overflow-hidden rounded-card bg-graphite p-5 text-white">
      <GaugeMotif className="absolute -right-6 -bottom-8 w-52" variant="card" />
      <div className="relative">
        <PlateTag onDark plate={vehicle.plate} size="lg" />
        <p className="mt-3 text-block font-bold">{vehicleLabel(vehicle)}</p>
        <p className="text-label text-graphite-ink">
          Dueño: {vehicle.current_owner?.name}
        </p>
        <div className="mt-3.5 flex flex-wrap gap-6">
          <span className="flex flex-col leading-tight">
            <span className="text-micro text-graphite-ink">
              Último kilometraje
            </span>
            <span className="font-semibold">
              {lastKm === null ? 'Sin visitas' : kilometers(lastKm)}
            </span>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-micro text-graphite-ink">Última visita</span>
            <span className="font-semibold">
              {lastVisit ? documentDate(lastVisit) : '—'}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Alta rápida de un mantenimiento (pantalla 1a): a la izquierda se busca el vehículo por placa
 * o dueño; a la derecha se ven sus datos, el aviso de deuda, el kilometraje de hoy y lo que pide
 * el cliente. Crea la orden con los endpoints de siempre y abre su ficha.
 */
export function NewMaintenanceDialog({
  open,
  onClose,
  initialSearch = '',
  returnFocusRef,
}: {
  open: boolean
  onClose: () => void
  /** Texto con que arranca la búsqueda, por ejemplo el nombre del cliente de la ficha. */
  initialSearch?: string
  returnFocusRef?: React.RefObject<HTMLElement | null>
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const tracker = useIntentTracker()
  const mutations = useMaintenanceMutations()
  const [search, setSearch] = useState(initialSearch)
  const [selected, setSelected] = useState<VehicleSummary | null>(null)
  const [odometer, setOdometer] = useState('')
  const [chips, setChips] = useState<string[]>([])
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [warning, setWarning] = useState<OdometerWarning | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const term = useDebounced(search.trim())
  const results = useVehicles(
    { search: term, isActive: true, pageSize: 6 },
    undefined,
  )
  const owner = selected?.current_owner ?? null
  const lastOrder = useMaintenanceOrders({
    vehicleId: selected?.id,
    pageSize: 1,
  })
  const ownerVehicles = useVehicleOptions(owner?.id ?? null)
  const openOrder =
    ownerVehicles.data?.results.find((v) => v.id === selected?.id)
      ?.open_order ?? null

  const last = lastOrder.data?.results[0]
  const lastKm = selected && last ? last.odometer_km : null
  const kmValid = /^\d+$/.test(odometer.trim())
  const canOpen =
    selected !== null &&
    owner !== null &&
    kmValid &&
    !openOrder &&
    !mutations.create.isPending

  // Sin texto no se lista nada: un orden alfabético de placas no ayuda a quien recibe el vehículo.
  const searched = term !== ''
  const list = searched
    ? (results.data?.results ?? []).filter(
        (vehicle) => vehicle.current_owner !== null,
      )
    : []

  async function openMaintenance() {
    if (!selected || !owner || !kmValid) return
    setProblem(null)
    const data = {
      customer_id: owner.id,
      vehicle_id: selected.id,
      opened_on: businessToday(),
      odometer_km: Number(odometer.trim()),
      diagnosis: '',
      notes: requestNotes(chips),
      ...(warning && confirmed ? { odometer_confirmed: true } : {}),
    }
    try {
      const saved = await tracker.run(data, (key) =>
        mutations.create.mutateAsync({ data, key }),
      )
      toast.success(`Mantenimiento ${saved.number} abierto.`)
      onClose()
      void navigate(`/maintenance/${saved.id}`)
    } catch (error) {
      setWarning(odometerWarningOf(error))
      setProblem(describeProblem(error))
    }
  }

  const toggleChip = (chip: string) =>
    setChips((current) =>
      current.includes(chip)
        ? current.filter((item) => item !== chip)
        : [...current, chip],
    )

  return (
    <Modal
      actions={
        <>
          <Button onClick={onClose} type="button" variant="ghost">
            Cancelar
          </Button>
          <Button
            className="min-w-[13.75rem]"
            disabled={!canOpen || (warning !== null && !confirmed)}
            onClick={() => void openMaintenance()}
            type="button"
          >
            Abrir mantenimiento
          </Button>
        </>
      }
      description="Busque el vehículo, revise sus datos y ábralo."
      onClose={onClose}
      open={open}
      returnFocusRef={returnFocusRef}
      size="xl"
      title="Nuevo mantenimiento"
    >
      <div className="grid min-h-[26rem] gap-0 md:grid-cols-2">
        <section
          aria-label="Buscar vehículo"
          className="flex min-w-0 flex-col gap-3 md:border-r md:border-line md:pr-6"
        >
          <label className="flex flex-col text-label font-medium text-ink-muted">
            ¿Qué vehículo llegó?
            <span className="relative mt-1 block">
              <MagnifyingGlass
                aria-hidden="true"
                className="absolute top-3 left-0.5 text-ink-muted"
                size={19}
              />
              <input
                autoComplete="off"
                autoFocus
                className="h-11 w-full border-0 border-b-[1.5px] border-line-strong bg-transparent pl-8 text-block font-medium text-ink outline-none placeholder:font-normal focus:border-ink"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Placa, nombre o cédula del dueño"
                ref={searchRef}
                value={search}
              />
            </span>
          </label>
          <ul className="-mx-2 flex flex-col gap-1" aria-label="Vehículos">
            {list.map((vehicle) => {
              const active = vehicle.id === selected?.id
              return (
                <li key={vehicle.id}>
                  <button
                    aria-pressed={active}
                    className={`flex min-h-16 w-full items-center gap-3.5 rounded-group border-[1.5px] px-3 py-2.5 text-left transition-colors ${active ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-canvas'}`}
                    onClick={() => {
                      setSelected(vehicle)
                      setWarning(null)
                      setConfirmed(false)
                      setProblem(null)
                    }}
                    type="button"
                  >
                    <PlateTag plate={vehicle.plate} />
                    <span className="flex min-w-0 flex-1 flex-col leading-snug">
                      <span className="truncate font-bold">
                        {vehicle.current_owner?.name}
                      </span>
                      <span className="truncate text-label text-ink-muted">
                        {vehicleLabel(vehicle)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {searched && results.isPending && (
            <p className="px-2 text-label text-ink-muted" role="status">
              Buscando…
            </p>
          )}
          {results.isError && (
            <InlineNotice title="No se pudo buscar" tone="danger">
              <Button
                onClick={() => void results.refetch()}
                type="button"
                variant="secondary"
              >
                Reintentar
              </Button>
            </InlineNotice>
          )}
          {searched && results.data && list.length === 0 && (
            <p className="px-2 py-5 text-center text-body text-ink-muted">
              Ningún vehículo con «{term}».
            </p>
          )}
          <Link
            className="mt-auto flex min-h-12 items-center justify-center gap-2 rounded-group border-[1.5px] border-dashed border-line-dashed text-body font-semibold text-ink-muted hover:text-ink"
            to="/maintenance/new"
          >
            + Cliente o vehículo que no está registrado
          </Link>
        </section>

        <section
          aria-label="Datos de llegada"
          className="flex min-w-0 flex-col gap-4 md:pl-6"
        >
          {!selected || !owner ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-card border-[1.5px] border-dashed border-line-strong p-8 text-center text-ink-muted">
              <Car aria-hidden="true" size={44} weight="light" />
              <span className="font-semibold text-ink">
                Elija el vehículo de la lista
              </span>
              <span className="text-label">
                Aquí verá su último kilometraje y si el cliente debe algo.
              </span>
            </div>
          ) : (
            <>
              <ArrivalCard
                lastKm={lastKm}
                lastVisit={last?.opened_on ?? null}
                vehicle={selected}
              />
              <CustomerDebt customerId={owner.id} />
              {openOrder && (
                <InlineNotice
                  title="El vehículo ya tiene un mantenimiento abierto"
                  tone="warning"
                >
                  Finalice el{' '}
                  <Link
                    className="font-semibold underline"
                    onClick={onClose}
                    to={`/maintenance/${openOrder.id}`}
                  >
                    {openOrder.number}
                  </Link>{' '}
                  antes de abrir otro para este vehículo.
                </InlineNotice>
              )}
              <label className="flex flex-col text-label font-medium text-ink-muted">
                Kilometraje de hoy
                <input
                  className="h-11 w-full border-0 border-b-[1.5px] border-line-strong bg-transparent text-figure font-semibold text-ink tabular-nums outline-none placeholder:font-normal focus:border-ink"
                  inputMode="numeric"
                  onChange={(event) => {
                    setOdometer(event.target.value)
                    setWarning(null)
                    setConfirmed(false)
                  }}
                  placeholder={
                    lastKm === null
                      ? '0'
                      : `Mayor a ${lastKm.toLocaleString('es-EC')}`
                  }
                  value={odometer}
                />
              </label>
              {warning && (
                <InlineNotice
                  title="Kilometraje menor al último conocido"
                  tone="warning"
                >
                  <p>
                    La orden {warning.order_number} registró{' '}
                    {kilometers(warning.last_known_km)}. Si el valor es correcto
                    (por ejemplo, cambio de tablero), confírmelo.
                  </p>
                  <div className="mt-2">
                    <Checkbox
                      checked={confirmed}
                      label="Confirmo que el kilometraje es correcto"
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                  </div>
                </InlineNotice>
              )}
              <div
                aria-label="Lo que pide el cliente"
                className="flex flex-col text-label font-medium text-ink-muted"
                role="group"
              >
                Lo que pide el cliente
                <div className="mt-2 flex flex-wrap gap-2">
                  {REQUEST_CHIPS.map((chip) => {
                    const on = chips.includes(chip)
                    return (
                      <button
                        aria-pressed={on}
                        className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-body ${on ? 'border-ink bg-ink font-semibold text-white' : 'border-line-strong bg-surface font-medium text-ink'}`}
                        key={chip}
                        onClick={() => toggleChip(chip)}
                        type="button"
                      >
                        {chip}
                      </button>
                    )
                  })}
                </div>
              </div>
              {problem && !warning && (
                <InlineNotice
                  title="No se abrió el mantenimiento"
                  tone="danger"
                >
                  {problem.message}
                </InlineNotice>
              )}
            </>
          )}
        </section>
      </div>
      <p className="mt-4 flex items-center gap-2 text-label text-ink-muted">
        <Wrench aria-hidden="true" size={14} />
        Se abre con la fecha de hoy. Los servicios y repuestos se agregan
        dentro.
      </p>
    </Modal>
  )
}
