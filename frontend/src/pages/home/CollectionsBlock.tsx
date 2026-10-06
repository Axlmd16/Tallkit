import { ChartBar } from '@phosphor-icons/react'

import { scopeOf } from '@/features/home/pendingTargets'
import type { HomeCollections } from '@/features/home/types'
import { MiniBarChart, SectionPanel } from '@/shared/ui'

import { BlockStates, isEmptyBlock, type BlockQuery } from './BlockStates'

const TITLE = 'Cobrado en 7 días'

/**
 * Dinero cobrado por día en la última semana, un gráfico por entidad fiscal y sin total
 * conjunto. Es solo lo que entró: no descuenta reembolsos ni reemplaza un cierre de caja.
 */
export function CollectionsBlock({
  query,
  className = '',
}: {
  query: BlockQuery<HomeCollections>
  className?: string
}) {
  if (isEmptyBlock(query, (data) => data.items.length === 0)) return null
  return (
    <SectionPanel
      className={className}
      icon={<ChartBar aria-hidden="true" size={17} weight="bold" />}
      id="home-collections"
      title={TITLE}
    >
      <BlockStates
        errorTitle="No se pudieron cargar los cobros"
        loadingLabel="Cargando cobros…"
        query={query}
      >
        {(data) => (
          <div
            className={`grid divide-y divide-line lg:divide-x lg:divide-y-0 ${data.items.length > 1 ? 'lg:grid-cols-2' : ''}`}
          >
            {data.items.map((item) => (
              <MiniBarChart
                days={item.days}
                key={item.scope}
                scope={scopeOf(item.scope)}
                title={TITLE}
                total={item.total}
              />
            ))}
          </div>
        )}
      </BlockStates>
    </SectionPanel>
  )
}
