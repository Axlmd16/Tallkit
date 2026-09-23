export interface PlateTagProps {
  plate: string
  className?: string
  /** `lg` para el resumen de una ficha; `md` en tablas y listas. */
  size?: 'md' | 'lg'
}

/**
 * Placa del vehículo como pieza reconocible: borde de tinta, franja superior con el naranja
 * del logotipo y número en monoespaciada.
 */
export function PlateTag({
  plate,
  className = '',
  size = 'md',
}: PlateTagProps) {
  const large = size === 'lg'
  return (
    <span
      className={`inline-flex shrink-0 flex-col overflow-hidden rounded-chip border-[1.5px] border-ink bg-surface leading-none ${className}`}
    >
      <span
        aria-hidden="true"
        className={large ? 'h-1.5 bg-brand' : 'h-1 bg-brand'}
      />
      <span
        className={`font-mono font-semibold tracking-[0.06em] text-ink ${large ? 'px-3 pt-1.5 pb-2 text-lg' : 'px-2 pt-1 pb-1.5 text-[12.5px]'}`}
      >
        {plate.trim().toUpperCase()}
      </span>
    </span>
  )
}
