import { useSession } from '@/features/auth/hooks'
import { useStock } from '@/features/inventory/hooks'
import { useProductBrandList } from '@/features/product-brands/hooks'
import { StatTile, StatTiles } from '@/shared/ui'

import { useProducts } from './hooks'

/**
 * Indicadores de la lista de productos: activos, marcas y agotados. Los conteos salen del
 * servidor; «Agotados» solo se pide con permiso de inventario y lleva a la lista de existencias.
 */
export function ProductsOverview() {
  const canSeeStock = new Set(useSession().data?.permissions ?? []).has(
    'inventario.ver',
  )
  const active = useProducts({ isActive: 'true', pageSize: 1 })
  const brands = useProductBrandList({ isActive: 'true', pageSize: 1 })
  const soldOut = useStock(
    { stock: 'zero', isActive: 'true', pageSize: 1 },
    canSeeStock,
  )
  return (
    <StatTiles label="Resumen de productos">
      <StatTile label="Productos activos" value={active.data?.count ?? '—'} />
      <StatTile label="Marcas" value={brands.data?.count ?? '—'} />
      {canSeeStock && (
        <StatTile
          label="Agotados"
          to="/inventory?stock=zero"
          tone={(soldOut.data?.count ?? 0) > 0 ? 'danger' : 'neutral'}
          value={soldOut.data?.count ?? '—'}
        />
      )}
    </StatTiles>
  )
}
