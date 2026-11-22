import { MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'

import { GaugeMotif } from '@/shared/ui'

const dateFormat = new Intl.DateTimeFormat('es-EC', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/** «Jueves 12 de noviembre». */
export function longToday(now = new Date()): string {
  const text = dateFormat.format(now).replace(',', '')
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1)
}

const heroButton =
  'ui-button inline-flex min-h-14 items-center justify-center gap-2 rounded-control border px-5 text-lead font-semibold whitespace-nowrap transition-[background-color,border-color,color] duration-150'

/**
 * Banda grafito del mostrador: la fecha, la pregunta del día, la búsqueda global y los dos
 * accesos de uso diario. `aside` recibe el recuadro «Cobrado hoy».
 */
export function CounterHero({
  onSearch,
  onNewMaintenance,
  quickSaleTo,
  aside,
}: {
  /** Abre la búsqueda global con el término ingresado; `null` si la sesión no puede buscar. */
  onSearch: ((term: string) => void) | null
  /** Abre el alta de un mantenimiento; `null` si la sesión no puede gestionarlos. */
  onNewMaintenance: (() => void) | null
  /** Ruta de la venta rápida; `null` si la sesión no puede vender. */
  quickSaleTo: string | null
  aside?: ReactNode
}) {
  const [term, setTerm] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!onSearch) return
    onSearch(term.trim())
  }

  return (
    <section
      aria-label="Mostrador"
      className="relative flex flex-wrap items-center gap-7 overflow-hidden rounded-dialog bg-graphite p-6 text-white sm:px-8 sm:py-7"
    >
      <GaugeMotif
        className="absolute -top-6 -right-10 w-[30rem] opacity-60"
        variant="card"
      />
      <div className="relative flex min-w-0 flex-[999_1_30rem] flex-col gap-4">
        <div>
          <p className="text-body font-medium text-graphite-ink">
            {longToday()}
          </p>
          <h1 className="mt-0.5 text-page font-bold tracking-tight">
            ¿Qué llegó al taller?
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onSearch && (
            <form
              className="flex h-14 min-w-[16rem] max-w-xl flex-1 items-center gap-3 rounded-group bg-surface px-4 text-ink-muted shadow-menu"
              onSubmit={submit}
              role="search"
            >
              <MagnifyingGlass aria-hidden="true" size={20} weight="bold" />
              <input
                aria-label="Buscar"
                className="min-w-0 flex-1 bg-transparent text-lead text-ink outline-none placeholder:text-ink-muted"
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Placa, cliente, cédula, producto o factura"
                type="search"
                value={term}
              />
            </form>
          )}
          {onNewMaintenance && (
            <button
              className={`${heroButton} border-primary bg-primary text-white hover:bg-primary-strong`}
              onClick={onNewMaintenance}
              type="button"
            >
              <Plus aria-hidden="true" size={18} weight="bold" />
              Nuevo mantenimiento
            </button>
          )}
          {quickSaleTo && (
            <Link
              className={`${heroButton} border-white/40 text-white hover:border-white hover:bg-white/10`}
              to={quickSaleTo}
            >
              Venta rápida
            </Link>
          )}
        </div>
      </div>
      {aside && <div className="relative min-w-[18rem] flex-1">{aside}</div>}
    </section>
  )
}
