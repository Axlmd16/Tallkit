/**
 * Marca de «sin costo registrado»: existencia sin valor conocido. Es distinto de un costo
 * cero, que sí se muestra como importe; por eso nunca se pinta un cero en su lugar.
 */
export function NoCost() {
  return (
    <span
      className="inline-block rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted"
      title="Sin costo registrado"
    >
      Sin costo
    </span>
  )
}
