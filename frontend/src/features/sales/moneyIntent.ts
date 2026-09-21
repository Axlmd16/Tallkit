/**
 * Conserva el UUID de una intención monetaria hasta su resolución, incluso tras recargar.
 *
 * Solo se guarda el identificador opaco, ligado a usuario, venta y acción: nunca importes,
 * cliente, motivo ni token de revisión. Al recargar, la interfaz consulta el estado de ese
 * UUID antes de ofrecer otra operación. Se limpia al cerrar o invalidar la sesión.
 */

const PREFIX = 'sales.intent.'
const memory = new Map<string, string>()

function storage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export type IntentAction =
  | 'payment'
  | 'correction'
  | 'replacement'
  | 'return'
  | 'refund'
  | 'void-refund'

export function intentKey(
  userScope: string | number,
  saleId: number,
  action: IntentAction,
  scope = '',
): string {
  return `${PREFIX}${userScope}.${saleId}.${action}${scope ? `.${scope}` : ''}`
}

export function peekIntent(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

/** Devuelve el UUID vigente de la intención o crea y conserva uno nuevo. */
export function getOrCreateIntent(key: string): string {
  const existing = peekIntent(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  memory.set(key, id)
  try {
    storage()?.setItem(key, id)
  } catch {
    /* sin sessionStorage el UUID vive solo en memoria */
  }
  return id
}

export function clearIntent(key: string): void {
  memory.delete(key)
  try {
    storage()?.removeItem(key)
  } catch {
    /* nada que limpiar */
  }
}

/** Elimina todas las intenciones (cierre o invalidación de sesión). */
export function clearMoneyIntents(): void {
  memory.clear()
  try {
    const store = storage()
    if (!store) return
    for (const key of Object.keys(store)) {
      if (key.startsWith(PREFIX)) store.removeItem(key)
    }
  } catch {
    /* nada que limpiar */
  }
}
