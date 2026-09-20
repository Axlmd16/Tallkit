import { ProblemError } from '@/shared/api/client'
import { isUncertainFailure } from '@/shared/api/idempotency'

export interface ProblemView {
  message: string
  fields: Record<string, string>
  /** No se sabe si el servidor aplicó la operación; el reintento reutiliza la clave. */
  uncertain: boolean
  staleRecord: boolean
}

const hints: Record<string, string> = {
  stale_record:
    'El registro cambió desde que lo abrió. Recargue la ficha para revisar los cambios; su borrador no se sobrescribe.',
  idempotency_conflict:
    'Esa solicitud ya se había enviado con datos distintos. Revise el formulario y vuelva a guardar.',
  category_has_active_products:
    'Reclasifique o desactive antes los productos activos de esta categoría.',
}

export function describeProblem(error: unknown): ProblemView {
  const uncertain = isUncertainFailure(error)
  if (error instanceof ProblemError) {
    const fields: Record<string, string> = {}
    for (const [name, messages] of Object.entries(error.errors ?? {})) {
      if (messages[0]) fields[name] = messages[0]
    }
    const hint = hints[error.code]
    const message =
      error.status === 0
        ? 'No se recibió respuesta del servidor; no sabemos si el cambio se aplicó. Al reintentar se enviará la misma solicitud sin duplicarla.'
        : error.status >= 500
          ? 'El servidor no pudo completar la operación; no sabemos si el cambio se aplicó. Al reintentar se enviará la misma solicitud sin duplicarla.'
          : hint
            ? `${error.message} ${hint}`
            : error.message
    return {
      message,
      fields,
      uncertain,
      staleRecord: error.code === 'stale_record',
    }
  }
  return {
    message:
      'Ocurrió un error inesperado. Revise la lista antes de reintentar.',
    fields: {},
    uncertain,
    staleRecord: false,
  }
}
