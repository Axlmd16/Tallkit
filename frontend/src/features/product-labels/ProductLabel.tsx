import { useEffect, useState } from 'react'

import { buildCode128Barcode } from './code128'
import type { ProductLabelData } from './label-layout'

export interface ProductLabelBrand {
  displayName: string
  logoUrl: string | null
}

export function ProductLabel({
  brand,
  onLogoReady,
  product,
}: {
  brand: ProductLabelBrand
  onLogoReady?: (() => void) | undefined
  product: ProductLabelData
}) {
  const [logoFailed, setLogoFailed] = useState(false)
  const barcode = buildCode128Barcode(product.code)
  const showLogo = Boolean(brand.logoUrl) && !logoFailed

  useEffect(() => {
    setLogoFailed(false)
    if (!brand.logoUrl) onLogoReady?.()
  }, [brand.logoUrl, onLogoReady])

  function settleLogo(failed: boolean) {
    if (failed) setLogoFailed(true)
    onLogoReady?.()
  }

  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden border-t-[0.8mm] border-black bg-white px-[2.2mm] pt-[1.2mm] pb-[1.5mm] text-black">
      <header className="flex h-[5mm] min-h-0 shrink-0 items-center gap-[1.5mm] border-b-[0.2mm] border-black/55 pb-[0.9mm]">
        {showLogo && (
          <img
            alt={`Logo de ${brand.displayName}`}
            className="max-h-[4mm] max-w-[12mm] shrink-0 object-contain"
            onError={() => settleLogo(true)}
            onLoad={() => settleLogo(false)}
            src={brand.logoUrl!}
          />
        )}
        <p className="min-w-0 flex-1 truncate text-[7pt] font-bold leading-tight tracking-[-0.01em]">
          {brand.displayName}
        </p>
        <span className="shrink-0 rounded-[0.8mm] border-[0.2mm] border-black/60 px-[1mm] py-[0.35mm] text-[4.3pt] font-bold leading-none tracking-[0.12em]">
          REPUESTO
        </span>
      </header>

      <div className="mt-[0.8mm] min-h-0">
        <p className="text-[4.3pt] font-bold leading-none tracking-[0.14em] text-black/60">
          CÓDIGO INTERNO
        </p>
        <p className="mt-[0.35mm] font-mono text-[13.5pt] font-bold leading-none tracking-[-0.025em]">
          {product.code}
        </p>
        <p className="line-clamp-2 mt-[0.7mm] text-[7.3pt] font-semibold leading-[1.08]">
          {product.name}
        </p>
      </div>

      {(product.manufacturerCode || product.productBrand) && (
        <dl className="mt-auto grid min-w-0 grid-cols-2 gap-[2mm] border-t-[0.2mm] border-black/25 pt-[0.65mm] leading-none">
          {product.manufacturerCode && (
            <div className="min-w-0">
              <dt className="text-[4pt] font-bold tracking-[0.1em] text-black/55">
                N.º DE PARTE
              </dt>
              <dd className="mt-[0.45mm] truncate font-mono text-[6.3pt] font-semibold">
                {product.manufacturerCode}
              </dd>
            </div>
          )}
          {product.productBrand && (
            <div className="min-w-0">
              <dt className="text-[4pt] font-bold tracking-[0.1em] text-black/55">
                MARCA
              </dt>
              <dd className="mt-[0.45mm] truncate text-[6.3pt] font-semibold">
                {product.productBrand.name}
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-[0.7mm] flex h-[7.2mm] shrink-0 items-stretch border-t-[0.2mm] border-black/55 pt-[0.7mm]">
        <svg
          aria-label={barcode.ariaLabel}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          shapeRendering="crispEdges"
          viewBox={`0 0 ${barcode.widthModules} ${barcode.heightModules}`}
        >
          {barcode.bars.map((bar, index) => (
            <rect
              fill="currentColor"
              height={barcode.heightModules}
              key={`${bar.x}-${index}`}
              width={bar.width}
              x={bar.x}
              y={0}
            />
          ))}
        </svg>
      </div>
    </article>
  )
}
