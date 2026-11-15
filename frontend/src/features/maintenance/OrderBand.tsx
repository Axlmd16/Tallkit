import { Link } from 'react-router'

import { GaugeMotif, PlateTag } from '@/shared/ui'

import { documentDate } from './format'
import { splitRequest } from './request'
import type { MaintenanceOrder, OrderListItem } from './types'

const hourFormat = new Intl.DateTimeFormat('es-EC', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Guayaquil',
})
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Guayaquil',
})
const stamp = new Intl.DateTimeFormat('es-EC', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Guayaquil',
})

/** «Desde 14/11/2026 a las 09:40»; sin la hora si la orden se abrió con otra fecha. */
export function sinceText(order: MaintenanceOrder): string {
  const created = new Date(order.created_at)
  const sameDay =
    !Number.isNaN(created.getTime()) &&
    dayFormat.format(created) === order.opened_on
  return sameDay
    ? `Desde ${documentDate(order.opened_on)} a las ${hourFormat.format(created)}`
    : `Desde ${documentDate(order.opened_on)}`
}

/** Frase corta con las fechas del ciclo de la orden: abierta, finalizada o reabierta. */
export function lifecycleText(order: MaintenanceOrder): string {
  const when = (value: string | null | undefined) =>
    value ? stamp.format(new Date(value)) : '—'
  if (order.state === 'FINALIZED')
    return `${sinceText(order)} · finalizada ${when(order.last_finalized_at)}`
  if (order.state === 'REOPENED') {
    const reopened = [...order.transitions]
      .reverse()
      .find((t) => t.to_state === 'REOPENED')
    return `Finalizada ${when(order.last_finalized_at)} · reabierta ${when(reopened?.occurred_at)}`
  }
  return sinceText(order)
}

/** Odómetro de seis cifras con la última en cobre; si el valor es mayor, muestra todas sus cifras. */
function Odometer({ km }: { km: number }) {
  const digits = String(km).padStart(6, '0').split('')
  return (
    <span
      aria-label={`${km.toLocaleString('es-EC')} kilómetros`}
      className="inline-flex gap-[3px] rounded-control bg-[#121417] p-[5px] ring-1 ring-graphite-line"
      role="img"
    >
      {digits.map((digit, index) => (
        <span
          aria-hidden="true"
          className={`grid h-[34px] w-6 place-items-center rounded-[5px] text-block font-semibold tabular-nums ${index === digits.length - 1 ? 'bg-primary text-white' : 'bg-gradient-to-b from-[#24282d] to-[#1a1d21] text-[#f2f1ee]'}`}
          key={index}
        >
          {digit}
        </span>
      ))}
    </span>
  )
}

/**
 * Banda grafito de la ficha: placa, vehículo y dueño; el kilometraje al llegar en un odómetro,
 * con lo recorrido desde la visita anterior, y lo que pidió el cliente.
 */
export function OrderBand({
  order,
  previous,
}: {
  order: MaintenanceOrder
  /** Visita anterior del mismo vehículo, si la hay. */
  previous: OrderListItem | undefined
}) {
  const request = splitRequest(order.notes)
  const delta = previous ? order.odometer_km - previous.odometer_km : null
  return (
    <section
      aria-label="Vehículo"
      className="relative flex flex-wrap items-center gap-x-9 gap-y-5 overflow-hidden rounded-dialog bg-graphite px-6 py-5 text-white"
    >
      <GaugeMotif
        className="absolute -top-4 -right-8 w-[26rem] opacity-60"
        variant="card"
      />
      <div className="relative flex min-w-[13.75rem] flex-col gap-2.5">
        <Link
          aria-label={`Vehículo ${order.vehicle.plate}`}
          className="self-start"
          to={`/vehicles/${order.vehicle.id}`}
        >
          <PlateTag onDark plate={order.vehicle.plate} size="lg" />
        </Link>
        <div className="leading-snug">
          <div className="text-block font-bold">
            {order.vehicle.brand} {order.vehicle.model}
          </div>
          <div className="text-label text-graphite-ink">
            Dueño:{' '}
            <Link
              className="text-white underline underline-offset-4"
              to={`/customers/${order.customer.id}`}
            >
              {order.customer.name}
            </Link>
          </div>
        </div>
      </div>
      <div className="relative flex flex-col gap-2">
        <span className="text-label font-medium text-graphite-ink">
          Kilometraje al llegar
        </span>
        <div className="flex items-end gap-2.5">
          <Odometer km={order.odometer_km} />
          <span className="pb-1 text-label font-semibold text-graphite-ink">
            km
          </span>
        </div>
        {previous && delta !== null && delta >= 0 && (
          <span className="text-label text-graphite-ink">
            <b className="font-semibold text-white tabular-nums">
              +{delta.toLocaleString('es-EC')} km
            </b>{' '}
            desde la última visita, el {documentDate(previous.opened_on)}
          </span>
        )}
        {order.odometer_confirmation && (
          <span className="text-label text-graphite-ink">
            Menor al último conocido; confirmado por{' '}
            {order.odometer_confirmation.by.name}
          </span>
        )}
      </div>
      <div className="relative flex min-w-0 flex-[1_1_16rem] flex-col gap-2">
        <span className="text-label font-medium text-graphite-ink">
          Lo que pide el cliente
        </span>
        {request.chips.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {request.chips.map((chip) => (
              <li
                className="inline-flex min-h-[30px] items-center rounded-full bg-white/10 px-3 text-label font-medium text-[#e2e3e5] ring-1 ring-white/15"
                key={chip}
              >
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
        {request.text ? (
          <span className="line-clamp-2 text-body text-[#e2e3e5]">
            «{request.text}»
          </span>
        ) : (
          request.chips.length === 0 && (
            <span className="text-body text-graphite-ink">
              Sin observaciones
            </span>
          )
        )}
      </div>
    </section>
  )
}
