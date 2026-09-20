import { FiscalScopeBadge, StatusBadge } from '@/shared/ui'

import { presentation, usd } from './format'
import type { Product } from './types'

function Group({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="space-y-3 rounded-group bg-surface p-5 shadow-card"
    >
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">{children}</dl>
    </section>
  )
}

function Item({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="font-semibold text-ink-muted">{label}</dt>
      <dd className="break-words text-ink">{children}</dd>
    </div>
  )
}

const taxText = (product: Product) => {
  if (!product.tax) return '—'
  const { code, name, tax_status: status, rate } = product.tax
  if (status === 'applicable') return `${code} — ${name} (${rate}%)`
  return `${code} — ${name} (${status === 'missing' ? 'vigencia pendiente' : 'vigencias ambiguas'})`
}

/** Ficha de solo lectura agrupada; el catálogo no guarda existencias ni costos; se consultan en Inventario. */
export function ProductDetails({ product }: { product: Product }) {
  const ref = (item: { name: string; is_active: boolean } | null) =>
    item ? `${item.name}${item.is_active ? '' : ' (inactiva)'}` : '—'
  return (
    <div className="space-y-4">
      <Group title="Identificación">
        <Item label="Código interno">{product.code}</Item>
        <Item label="Código del fabricante">
          {product.manufacturer_code || '—'}
        </Item>
        <Item label="Nombre">{product.name}</Item>
        <Item label="Descripción">{product.description || '—'}</Item>
        <Item label="Estado">
          <StatusBadge
            label={product.is_active ? 'Activo' : 'Inactivo'}
            tone={product.is_active ? 'success' : 'neutral'}
          />
        </Item>
      </Group>
      <Group title="Presentación">
        <Item label="Contenido">{presentation(product)}</Item>
        <Item label="Kit comprado completo">
          {product.is_kit ? 'Sí' : 'No'}
        </Item>
      </Group>
      <Group title="Referencias">
        <Item label="Categoría">{ref(product.category)}</Item>
        <Item label="Unidad de medida">{ref(product.unit)}</Item>
        <Item label="Marca de producto">{ref(product.product_brand)}</Item>
        <Item label="Marcas de vehículo compatibles">
          {product.vehicle_brands.length === 0
            ? '—'
            : product.vehicle_brands.map((b) => ref(b)).join(', ')}
        </Item>
      </Group>
      <Group title="Importe e impuesto">
        <Item label="Precio final">{usd(product.sale_price)}</Item>
        <Item label="Impuesto">
          <span className="inline-flex flex-wrap items-center gap-2">
            <FiscalScopeBadge scope="commercial" />
            {taxText(product)}
          </span>
        </Item>
      </Group>
    </div>
  )
}
