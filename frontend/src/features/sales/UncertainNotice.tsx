import { Button, InlineNotice } from '@/shared/ui'

/**
 * Resultado incierto de una operación de dinero. No afirma que el dinero no se entregó ni
 * que el registro falló: solo que el servidor no confirmó. Permite consultar el estado por
 * UUID o reintentar el mismo hecho con la misma identidad, sin duplicarlo.
 */
export function UncertainNotice({
  onCheck,
  onRetry,
  busy = false,
}: {
  onCheck: () => void
  onRetry: () => void
  busy?: boolean
}) {
  return (
    <InlineNotice
      title="No recibimos la confirmación del servidor"
      tone="warning"
    >
      <p>
        No sabemos si el registro llegó a guardarse. Esto no indica si el dinero
        se entregó o no: registrar el hecho en el sistema es distinto de
        entregar el dinero. No entregue ni pida otro desembolso todavía.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          disabled={busy}
          onClick={onCheck}
          type="button"
          variant="secondary"
        >
          Consultar estado
        </Button>
        <Button disabled={busy} onClick={onRetry} type="button">
          Reintentar el mismo registro
        </Button>
      </div>
    </InlineNotice>
  )
}
