const PREFIX = 'Pide el cliente: '

/** Observaciones de la orden a partir de lo que pide el cliente; vacío si no eligió nada. */
export function requestNotes(chips: readonly string[]): string {
  return chips.length === 0 ? '' : `${PREFIX}${chips.join(', ')}.`
}

/**
 * Inversa de `requestNotes`: separa los motivos elegidos al abrir el mantenimiento del resto de
 * las observaciones. Un texto que no empieza con la frase se devuelve íntegro como texto libre.
 */
export function splitRequest(notes: string): { chips: string[]; text: string } {
  const trimmed = notes.trim()
  if (!trimmed.startsWith(PREFIX)) return { chips: [], text: trimmed }
  const end = trimmed.indexOf('.\n')
  const head = end === -1 ? trimmed : trimmed.slice(0, end + 1)
  const rest = end === -1 ? '' : trimmed.slice(end + 2)
  const list = head.slice(PREFIX.length).replace(/\.$/, '')
  return {
    chips: list
      .split(', ')
      .map((chip) => chip.trim())
      .filter(Boolean),
    text: rest.trim(),
  }
}
