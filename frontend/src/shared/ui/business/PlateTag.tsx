export interface PlateTagProps {
  plate: string
  className?: string
  /** `lg` para el resumen de una ficha; `md` en tablas y listas. */
  size?: 'md' | 'lg'
  /** Sobre una superficie oscura (tarjeta grafito) la pieza se invierte: fondo blanco y letras grafito. */
  onDark?: boolean
}

/**
 * Placa del vehículo como pieza reconocible: chip de tinta con letras blancas espaciadas y cifras
 * de ancho uniforme. Sobre una superficie oscura se invierte.
 */
export function PlateTag({
  plate,
  className = '',
  size = 'md',
  onDark = false,
}: PlateTagProps) {
  const large = size === 'lg'
  return (
    <span
      className={`code inline-flex shrink-0 items-center rounded-chip font-semibold tracking-[0.12em] ${onDark ? 'bg-white text-graphite' : 'bg-ink text-white'} ${large ? 'px-3.5 py-1.5 text-block' : 'px-2.5 py-1 text-label'} ${className}`}
      data-on-dark={onDark ? 'true' : undefined}
    >
      {plate.trim().toUpperCase()}
    </span>
  )
}
