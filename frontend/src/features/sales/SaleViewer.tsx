import {
  ArrowsHorizontal,
  CheckCircle,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  SpinnerGap,
  WarningCircle,
  type Icon,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Tooltip } from '@/shared/ui'

import type { Issue } from './types'

/** Ancho de una hoja A4 a 96 ppp; la escala solo afecta a la presentación. */
const SHEET_WIDTH = 794
const MIN_ZOOM = 50
const MAX_ZOOM = 150
const STEP = 10

export type ViewerPhase = 'fresh' | 'updating' | 'incomplete'

const phases: Record<ViewerPhase, { label: string; icon: Icon }> = {
  fresh: { label: 'Actualizada', icon: CheckCircle },
  updating: { label: 'Actualizando…', icon: SpinnerGap },
  incomplete: { label: 'Incompleta', icon: WarningCircle },
}

function ViewerButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  pressed?: boolean
  children: ReactNode
}) {
  return (
    <Tooltip content={label} position="bottom">
      <button
        aria-label={label}
        aria-pressed={pressed}
        className="sale-icon-button"
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {children}
      </button>
    </Tooltip>
  )
}

/**
 * Marco de visor de documentos: barra propia con estado y zoom, franja compacta de avisos
 * y un espacio de trabajo gris donde se centra la hoja. No imprime ni exporta: solo se
 * ofrecen acciones que existen.
 */
export function SaleViewer({
  phase,
  issues,
  failed,
  children,
}: {
  phase: ViewerPhase
  issues: Issue[]
  failed: boolean
  children: ReactNode
}) {
  const stage = useRef<HTMLDivElement>(null)
  const [fitPct, setFitPct] = useState(100)
  const [manual, setManual] = useState<number | null>(null)
  const pct = manual ?? fitPct
  const { label, icon: PhaseIcon } = phases[phase]

  useEffect(() => {
    const node = stage.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const width = node.clientWidth
      if (width <= 0) return
      const fit = Math.floor(((width - 32) / SHEET_WIDTH) * 100)
      setFitPct(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fit)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const zoomTo = (next: number) =>
    setManual(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)))

  return (
    <>
      <div className="sale-viewer-bar">
        <h2>Vista previa</h2>
        <span
          aria-label="Estado de los importes"
          aria-live="polite"
          className={`sale-phase ${phase}`}
          role="status"
        >
          <PhaseIcon aria-hidden="true" size={14} weight="bold" />
          {label}
        </span>
        <div className="sale-zoom" role="group" aria-label="Zoom de la hoja">
          <ViewerButton
            disabled={pct <= MIN_ZOOM}
            label="Reducir zoom"
            onClick={() => zoomTo(pct - STEP)}
          >
            <MagnifyingGlassMinus aria-hidden="true" size={18} />
          </ViewerButton>
          <output aria-label="Nivel de zoom">{pct} %</output>
          <ViewerButton
            disabled={pct >= MAX_ZOOM}
            label="Aumentar zoom"
            onClick={() => zoomTo(pct + STEP)}
          >
            <MagnifyingGlassPlus aria-hidden="true" size={18} />
          </ViewerButton>
          <ViewerButton
            label="Ajustar al ancho"
            onClick={() => setManual(null)}
            pressed={manual === null}
          >
            <ArrowsHorizontal aria-hidden="true" size={18} />
          </ViewerButton>
        </div>
      </div>
      {(failed || phase === 'updating' || issues.length > 0) && (
        <div
          className={`sale-strip ${failed || issues.length > 0 ? 'warn' : ''}`}
        >
          {failed ? (
            <span>
              No se pudieron calcular los importes; se muestran guiones. Siga
              editando para reintentar.
            </span>
          ) : phase === 'updating' ? (
            <span>Actualizando importes…</span>
          ) : (
            <span>
              <strong>Faltan datos:</strong>{' '}
              {issues.map((issue) => issue.message).join(' · ')}
            </span>
          )}
        </div>
      )}
      <div
        aria-label="Espacio de trabajo del documento"
        className="sale-stage"
        ref={stage}
        role="group"
        tabIndex={0}
      >
        <div className="sale-sheet-frame" style={{ zoom: pct / 100 }}>
          {children}
        </div>
      </div>
    </>
  )
}
