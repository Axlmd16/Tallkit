import {
  Barcode,
  Car,
  Cube,
  Factory,
  Hash,
  Info,
  Ruler,
  Tag,
  TextAlignLeft,
} from '@phosphor-icons/react'

import { RecordFooter } from '@/features/catalog-common/RecordFooter'
import { DetailItem, PartCode, SectionPanel, StatusBadge } from '@/shared/ui'

import { presentation } from './format'
import type { CatalogRef, Product } from './types'

const empty = <span className="font-normal text-ink-muted">—</span>

function Reference({ item }: { item: CatalogRef | null }) {
  if (!item) return empty
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {item.name}
      {!item.is_active && (
        <StatusBadge kind="category" label="Inactiva" tone="neutral" />
      )}
    </span>
  )
}

/** Columna principal: identificación, clasificación, descripción y compatibilidad. */
export function ProductDetails({ product }: { product: Product }) {
  return (
    <div className="space-y-4">
      <SectionPanel
        icon={<Info size={17} />}
        id="product-general"
        title="Datos generales"
      >
        <dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          <DetailItem icon={<Barcode size={15} />} label="Código interno">
            <PartCode code={product.code} />
          </DetailItem>
          <DetailItem icon={<Hash size={15} />} label="Código del fabricante">
            {product.manufacturer_code ? (
              <PartCode code={product.manufacturer_code} />
            ) : (
              empty
            )}
          </DetailItem>
          <DetailItem icon={<Cube size={15} />} label="Presentación">
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {presentation(product)}
              {product.is_kit && (
                <StatusBadge kind="category" label="Kit completo" tone="info" />
              )}
            </span>
          </DetailItem>
          <DetailItem icon={<Tag size={15} />} label="Categoría">
            <Reference item={product.category} />
          </DetailItem>
          <DetailItem icon={<Ruler size={15} />} label="Unidad de medida">
            <Reference item={product.unit} />
          </DetailItem>
          <DetailItem icon={<Factory size={15} />} label="Marca de producto">
            <Reference item={product.product_brand} />
          </DetailItem>
          <DetailItem
            className="border-t border-line pt-4 sm:col-span-2 xl:col-span-3"
            icon={<TextAlignLeft size={15} />}
            label="Descripción"
          >
            <span className="font-normal whitespace-pre-line">
              {product.description || (
                <span className="text-ink-muted">Sin descripción</span>
              )}
            </span>
          </DetailItem>
        </dl>
        <RecordFooter
          createdAt={product.created_at}
          updatedAt={product.updated_at}
        />
      </SectionPanel>

      <SectionPanel
        description="Marcas de vehículo con las que se usa este repuesto."
        icon={<Car size={17} />}
        id="product-compatibility"
        title="Compatibilidad"
      >
        <div className="p-4">
          {product.vehicle_brands.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              Universal: sin marcas de vehículo asignadas.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {product.vehicle_brands.map((brand) => (
                <li
                  className={`inline-flex min-h-7 items-center gap-1.5 rounded-chip border border-line bg-surface-subtle px-2.5 text-[12.5px] font-medium ${brand.is_active ? 'text-ink' : 'text-ink-muted'}`}
                  key={brand.id}
                >
                  <Car aria-hidden="true" size={14} />
                  {brand.name}
                  {!brand.is_active && (
                    <span className="text-xs">(inactiva)</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionPanel>
    </div>
  )
}
