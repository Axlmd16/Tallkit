import { HandCoins } from '@phosphor-icons/react'

import { RECEIVABLE_TARGETS, scopeOf } from '@/features/home/pendingTargets'
import type { HomeReceivables } from '@/features/home/types'
import { SectionPanel, StatGrid, StatLink } from '@/shared/ui'

import { BlockStates, isEmptyBlock, type BlockQuery } from './BlockStates'

function customersText(count: number): string {
  if (count === 0) return 'Sin clientes con deuda'
  return count === 1 ? '1 cliente' : `${count} clientes`
}

/**
 * Saldo por cobrar de cada entidad fiscal. Repuestos y servicios son dos RUC distintos: se
 * muestran lado a lado y nunca se suman.
 */
export function ReceivablesBlock({
  query,
  className = '',
}: {
  query: BlockQuery<HomeReceivables>
  className?: string
}) {
  if (isEmptyBlock(query, (data) => data.items.length === 0)) return null
  return (
    <SectionPanel
      className={className}
      icon={<HandCoins aria-hidden="true" size={17} weight="bold" />}
      id="home-receivables"
      title="Por cobrar"
    >
      <BlockStates
        errorTitle="No se pudieron cargar los saldos por cobrar"
        loadingLabel="Cargando saldos por cobrar…"
        query={query}
      >
        {(data) => (
          <StatGrid
            columns={2}
            label="Saldos por cobrar por entidad"
            stackOnWide
          >
            {data.items.map((item) => (
              <StatLink
                amount={item.balance}
                detail={customersText(item.customers)}
                key={item.scope}
                label={RECEIVABLE_TARGETS[item.scope].label}
                scope={scopeOf(item.scope)}
                to={RECEIVABLE_TARGETS[item.scope].to}
              />
            ))}
          </StatGrid>
        )}
      </BlockStates>
    </SectionPanel>
  )
}
