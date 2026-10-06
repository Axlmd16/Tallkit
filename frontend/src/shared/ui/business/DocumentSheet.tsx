import { useEffect, useState, type ReactNode } from 'react'

import './document-sheet.css'

export interface DocumentSheetMeta {
  label: string
  value: ReactNode
  /** Ocupa el ancho completo de la cabecera de datos. */
  wide?: boolean
}

/** Entidad fiscal emisora que encabeza la hoja (PPF-09). */
export interface DocumentSheetIssuer {
  name: string
  /** `undefined` mientras se consulta; `null` si la entidad no tiene logotipo. */
  logoUrl: string | null | undefined
}

/**
 * Hoja A4 del documento interno: identidad del emisor, tipo «COMPROBANTE INTERNO», estado,
 * número (o «Pendiente de confirmación»), datos de cabecera, contenido del documento, el aviso
 * de que no constituye una factura electrónica y la mención «Generado con Tallkit». Se usa en
 * la vista previa, el comprobante confirmado y la impresión; nunca calcula importes.
 * `onBrandReady` avisa cuando el encabezado ya no cambiará: sin logotipo, o cuando la imagen
 * cargó o falló, para imprimir sin una imagen incompleta.
 */
export function DocumentSheet({
  busy = false,
  children,
  issuer,
  label,
  meta,
  notice,
  number,
  onBrandReady,
  state,
  title = 'COMPROBANTE INTERNO',
}: {
  busy?: boolean
  children: ReactNode
  issuer: DocumentSheetIssuer
  label: string
  meta: DocumentSheetMeta[]
  /** Aviso al pie; `null` lo omite, como en la cotización que se entrega al cliente. */
  notice: string | null
  number: string | null
  onBrandReady?: ((ready: boolean) => void) | undefined
  state: string
  /** Tipo de documento del encabezado; una proforma se rotula «COTIZACIÓN». */
  title?: string | undefined
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const logoUrl =
    issuer.logoUrl && issuer.logoUrl !== failedUrl ? issuer.logoUrl : null

  useEffect(() => {
    if (
      issuer.logoUrl === null ||
      (issuer.logoUrl && issuer.logoUrl === failedUrl)
    )
      onBrandReady?.(true)
  }, [issuer.logoUrl, failedUrl, onBrandReady])

  useEffect(() => {
    // Página A4 sin márgenes propios: el margen del impreso lo aporta la hoja con su relleno,
    // de modo que el resultado no depende del navegador. La regla coincide con la de las
    // etiquetas de productos (ambas son globales) y solo vive mientras la hoja está montada.
    const style = document.createElement('style')
    style.media = 'print'
    style.dataset.documentSheetPage = ''
    style.textContent = '@page { size: A4; margin: 0; }'
    document.head.append(style)
    return () => style.remove()
  }, [])

  return (
    <article aria-busy={busy} aria-label={label} className="document-sheet">
      <header className="sheet-head">
        <div aria-label="Emisor" className="sheet-brand" role="group">
          {logoUrl && (
            <img
              alt={`Logo de ${issuer.name}`}
              className="sheet-logo"
              onError={() => setFailedUrl(logoUrl)}
              onLoad={() => onBrandReady?.(true)}
              src={logoUrl}
            />
          )}
          <span className="sheet-issuer">{issuer.name}</span>
        </div>
        <div className="sheet-kind">
          <p className="sheet-title">{title}</p>
          <p className="sheet-state">{state}</p>
        </div>
      </header>
      <dl className="sheet-meta">
        <div>
          <dt>Número</dt>
          <dd>
            {number === null ? (
              'Pendiente de confirmación'
            ) : (
              <span className="font-mono">{number}</span>
            )}
          </dd>
        </div>
        {meta.map((item) => (
          <div className={item.wide ? 'wide' : undefined} key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      {children}
      {notice !== null && (
        <>
          <p className="sheet-notice">{notice}</p>
          <p className="sheet-credit">Generado con Tallkit</p>
        </>
      )}
    </article>
  )
}
