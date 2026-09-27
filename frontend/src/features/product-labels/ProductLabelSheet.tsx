import type { CSSProperties } from 'react'

import { ProductLabel, type ProductLabelBrand } from './ProductLabel'
import type { LabelGrid, ProductLabelCell } from './label-layout'

export function ProductLabelSheet({
  brand,
  className = '',
  grid,
  onLogoReady,
  page,
}: {
  brand: ProductLabelBrand
  className?: string | undefined
  grid: LabelGrid
  onLogoReady?: (() => void) | undefined
  page: ProductLabelCell[]
}) {
  const style: CSSProperties = {
    width: `${grid.pageWidthMm}mm`,
    height: `${grid.pageHeightMm}mm`,
    paddingInline: `${grid.offsetXmm}mm`,
    paddingBlock: `${grid.offsetYmm}mm`,
    gridTemplateColumns: `repeat(${grid.columns}, ${grid.labelWidthMm}mm)`,
    gridTemplateRows: `repeat(${grid.rows}, ${grid.labelHeightMm}mm)`,
  }

  return (
    <section
      className={`product-label-sheet grid box-border bg-white text-black ${className}`}
      data-testid="product-label-sheet"
      style={style}
    >
      {page.map((cell, index) => (
        <div
          className="product-label-cell box-border overflow-hidden border-r-[0.2mm] border-b-[0.2mm] border-black/50"
          data-testid="product-label-cell"
          key={index}
          style={{
            borderLeftWidth: index % grid.columns === 0 ? '0.2mm' : undefined,
            borderTopWidth: index < grid.columns ? '0.2mm' : undefined,
          }}
        >
          {cell ? (
            <ProductLabel
              brand={brand}
              onLogoReady={onLogoReady}
              product={cell.product}
            />
          ) : (
            <span data-testid="empty-label-cell" />
          )}
        </div>
      ))}
    </section>
  )
}
