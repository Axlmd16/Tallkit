import type { ReactNode } from 'react'

import brandMark from '@/assets/brand/isotipo.svg'

import './document-sheet.css'

export interface DocumentSheetMeta {
  label: string
  value: ReactNode
  /** Ocupa el ancho completo de la cabecera de datos. */
  wide?: boolean
}

/**
 * Hoja A4 del documento interno: marca Tallkit, tipo «COMPROBANTE INTERNO», estado, número
 * (o «Pendiente de confirmación»), datos de cabecera, contenido del documento y el aviso de
 * que no constituye una factura electrónica. Se usa en la vista previa, el comprobante
 * confirmado y la impresión; nunca calcula importes.
 */
export function DocumentSheet({
  busy = false,
  children,
  label,
  meta,
  notice,
  number,
  state,
}: {
  busy?: boolean
  children: ReactNode
  label: string
  meta: DocumentSheetMeta[]
  notice: string
  number: string | null
  state: string
}) {
  return (
    <article aria-busy={busy} aria-label={label} className="document-sheet">
      <header className="sheet-head">
        <div className="sheet-brand">
          <img alt="" className="sheet-mark" src={brandMark} />
          <span>Tallkit</span>
        </div>
        <div className="sheet-kind">
          <p className="sheet-title">COMPROBANTE INTERNO</p>
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
      <p className="sheet-notice">{notice}</p>
    </article>
  )
}
