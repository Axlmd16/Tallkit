import { useQuery } from '@tanstack/react-query'

import { getHealth } from '@/shared/api/health'
import { environment } from '@/shared/config/env'

export function TechnicalStatusPage() {
  const health = useQuery({
    queryKey: ['technical-health'],
    queryFn: () => getHealth(environment.apiBaseUrl),
    retry: false,
  })

  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
        {environment.appName}
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
        Estado técnico
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
        Base técnica del sistema de gestión para el taller automotriz.
      </p>

      <div
        aria-live="polite"
        className="mt-8 rounded-2xl border border-slate-700 bg-slate-950/60 p-5"
      >
        {health.isPending && <p>Comprobando backend y PostgreSQL…</p>}
        {health.isSuccess && (
          <p className="font-medium text-emerald-300">
            Backend y PostgreSQL disponibles
          </p>
        )}
        {health.isError && (
          <p className="font-medium text-rose-300">
            Backend o PostgreSQL no disponible
          </p>
        )}
      </div>

      <button
        className="mt-6 min-h-11 rounded-xl bg-cyan-400 px-5 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60"
        disabled={health.isFetching}
        onClick={() => void health.refetch()}
        type="button"
      >
        Comprobar nuevamente
      </button>
    </section>
  )
}
