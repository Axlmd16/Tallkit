import { useEffect, useId, useState, type CSSProperties } from 'react'

import truckBackgroundUrl from '@/assets/product-label-truck-background.png'

import { buildCode128Barcode } from './code128'
import type { ProductLabelData } from './label-layout'
import './product-label.css'

export interface ProductLabelBrand {
  displayName: string
  logoUrl: string | null
}

// Tamaño del código interno (mm) con un código de hasta nueve caracteres.
const CODE_BASE_SIZE_MM = 7.2
// Code 128 del pie: módulo objetivo y límites del ancho del símbolo (mm).
const BARCODE_MODULE_MM = 0.33
const BARCODE_MIN_WIDTH_MM = 40
const BARCODE_MAX_WIDTH_MM = 88

function formatQuantity(value: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) return value
  const fraction = (match[2] ?? '').replace(/0+$/, '')
  return fraction ? `${match[1]},${fraction}` : match[1]!
}

function codeSizeFactor(code: string): number {
  if (code.length <= 9) return 1
  if (code.length <= 11) return 0.84
  if (code.length <= 14) return 0.68
  if (code.length <= 18) return 0.53
  return 0.4
}

function SpecIcon({ kind }: { kind: 'part' | 'brand' | 'presentation' }) {
  if (kind === 'part') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M10.3 1.5h3.4l.6 2.9c.8.3 1.6.7 2.3 1.3l2.8-1 1.7 3-2.2 2c.1.8.1 1.7 0 2.5l2.2 2-1.7 3-2.8-1c-.7.6-1.5 1-2.3 1.3l-.6 2.9h-3.4l-.6-2.9c-.8-.3-1.6-.7-2.3-1.3l-2.8 1-1.7-3 2.2-2a8 8 0 0 1 0-2.5l-2.2-2 1.7-3 2.8 1c.7-.6 1.5-1 2.3-1.3l.6-2.9ZM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"
          fill="currentColor"
        />
      </svg>
    )
  }
  if (kind === 'brand') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M13.2 2.5h7.3a1 1 0 0 1 1 1v7.3a1 1 0 0 1-.3.7l-9.8 9.8a1 1 0 0 1-1.4 0l-7.3-7.3a1 1 0 0 1 0-1.4l9.8-9.8a1 1 0 0 1 .7-.3Zm3.8 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
          fill="currentColor"
        />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m12 1.8 9.2 4.6L12 11 2.8 6.4 12 1.8Z" fill="currentColor" />
      <path d="M2 8.1 11.2 12.7V22.4L2 17.6V8.1Z" fill="currentColor" />
      <path
        d="m22 8.1-9.2 4.6v9.7l9.2-4.8V8.1Z"
        fill="currentColor"
        opacity="0.78"
      />
    </svg>
  )
}

/**
 * Recurso fijo de la esquina superior derecha: fotografía original del camión
 * teñida en azul, con bandas diagonales azul marino y naranja a la izquierda.
 * Coordenadas en milímetros de diseño (48 × 15); cada tamaño lo escala por CSS.
 */
function TruckArt() {
  const id = useId().replace(/:/g, '')
  const clipId = `label-truck-clip-${id}`
  const filterId = `label-truck-tint-${id}`

  return (
    <svg
      aria-hidden="true"
      className="product-label__truck"
      data-testid="product-label-truck-art"
      preserveAspectRatio="xMaxYMin meet"
      viewBox="0 0 48 15"
    >
      <defs>
        <clipPath id={clipId}>
          <polygon points="6.5,0 48,0 48,15 45.4,12.3 21.75,12.3" />
        </clipPath>
        <filter colorInterpolationFilters="sRGB" id={filterId}>
          <feColorMatrix
            type="matrix"
            values="0.14 0.28 0.05 0 0.24 0.16 0.32 0.06 0 0.31 0.18 0.36 0.07 0 0.41 0 0 0 1 0"
          />
        </filter>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect fill="#33475f" height="15" width="48" />
        <image
          filter={`url(#${filterId})`}
          height="15"
          href={truckBackgroundUrl}
          preserveAspectRatio="xMaxYMid slice"
          width="43"
          x="5"
        />
      </g>
      <polygon fill="#f4a51c" points="0,0 1.2,0 16.45,12.3 15.25,12.3" />
      <polygon fill="#13233b" points="1.2,0 6.5,0 16.8,8.3 11.5,8.3" />
      <polygon
        fill="#f4a51c"
        points="11.5,8.3 16.8,8.3 21.75,12.3 16.45,12.3"
      />
    </svg>
  )
}

function Barcode({ code }: { code: string }) {
  const barcode = buildCode128Barcode(code)
  const width = Math.min(
    BARCODE_MAX_WIDTH_MM,
    Math.max(BARCODE_MIN_WIDTH_MM, barcode.widthModules * BARCODE_MODULE_MM),
  )
  return (
    <div
      className="product-label__barcode"
      data-testid="product-label-barcode"
      style={{ '--barcode-width': `${width.toFixed(1)}mm` } as CSSProperties}
    >
      <svg
        aria-label={barcode.ariaLabel}
        preserveAspectRatio="none"
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
      <p>{code}</p>
    </div>
  )
}

function SpecRow({
  kind,
  label,
  value,
  wrap = false,
}: {
  kind: 'part' | 'brand' | 'presentation'
  label: string
  value: string
  wrap?: boolean
}) {
  return (
    <div
      aria-label={label}
      className={`product-label__spec${wrap ? ' product-label__spec--wrap' : ''}`}
      role="group"
    >
      <SpecIcon kind={kind} />
      <div className="product-label__spec-text">
        <p className="product-label__spec-label">{label.toUpperCase()}</p>
        <p className="product-label__spec-value">{value}</p>
      </div>
    </div>
  )
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
  const logoInstanceId = useId().replace(/:/g, '')
  const [logoFailed, setLogoFailed] = useState(false)
  const showLogo = Boolean(brand.logoUrl) && !logoFailed
  const presentation = [
    formatQuantity(product.contentQuantity),
    product.unit?.name,
  ]
    .filter(Boolean)
    .join(' ')
  const codeSize = CODE_BASE_SIZE_MM * codeSizeFactor(product.code)

  useEffect(() => {
    setLogoFailed(false)
    if (!brand.logoUrl) onLogoReady?.()
  }, [brand.logoUrl, onLogoReady])

  function settleLogo(failed: boolean) {
    if (failed) setLogoFailed(true)
    onLogoReady?.()
  }

  return (
    <article className="product-label">
      <div className="product-label__brand">
        {showLogo ? (
          <>
            <svg
              aria-label={`Logo de ${brand.displayName}`}
              className="product-label__brand-logo"
              preserveAspectRatio="xMinYMid meet"
              role="img"
              viewBox="0 0 100 100"
            >
              <image
                height="100"
                href={`${brand.logoUrl!}#${logoInstanceId}`}
                preserveAspectRatio="xMinYMid meet"
                width="100"
              />
            </svg>
            <img
              alt=""
              aria-hidden="true"
              className="product-label__brand-loader"
              onError={() => settleLogo(true)}
              onLoad={() => settleLogo(false)}
              src={brand.logoUrl!}
            />
          </>
        ) : (
          <p className="product-label__brand-name">{brand.displayName}</p>
        )}
      </div>
      <span aria-hidden="true" className="product-label__brand-rule" />
      <TruckArt />

      <div className="product-label__code">
        <p className="product-label__code-caption">CÓDIGO</p>
        <p
          className="product-label__code-value"
          data-testid="product-label-code"
          style={{ '--code-size': codeSize.toFixed(2) } as CSSProperties}
        >
          {product.code}
        </p>
      </div>

      <div className="product-label__text">
        <p className="product-label__name">{product.name}</p>
        {product.description && (
          <p className="product-label__description">{product.description}</p>
        )}
        <span aria-hidden="true" className="product-label__accent" />
      </div>

      <div className="product-label__specs" data-testid="product-label-specs">
        {product.manufacturerCode && (
          <SpecRow
            kind="part"
            label="N.º de parte"
            value={product.manufacturerCode}
          />
        )}
        {product.productBrand && (
          <SpecRow
            kind="brand"
            label="Marca"
            value={product.productBrand.name}
            wrap
          />
        )}
        {presentation && (
          <SpecRow
            kind="presentation"
            label="Presentación"
            value={presentation}
          />
        )}
      </div>

      <footer
        className="product-label__footer"
        data-testid="product-label-footer"
      >
        <Barcode code={product.code} />
      </footer>
    </article>
  )
}
