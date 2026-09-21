import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'

import {
  describeProblem,
  type ProblemView,
} from '@/features/catalog-common/problem'
import { useIntentTracker } from '@/shared/api/idempotency'
import { useLatestReview } from '@/shared/api/latest-review'
import { Button, Dialog, InlineNotice, LoadingState } from '@/shared/ui'

import { useOperationStatus } from './hooks'
import { clearIntent, getOrCreateIntent, peekIntent } from './moneyIntent'
import { UncertainNotice } from './UncertainNotice'
import type { MoneyReview } from './types'

const canDo = (review: MoneyReview | null) =>
  review?.can_register ??
  review?.can_correct ??
  review?.can_return ??
  review?.can_void ??
  false

/**
 * Cuadro de una operación de dinero: revisión de solo lectura y registro con identidad
 * estable. Conserva el UUID de la intención en ``sessionStorage`` hasta su resolución; al
 * abrirse tras una recarga consulta primero el estado de ese UUID. Registrar un hecho en el
 * sistema no es entregar dinero: el texto lo dice y no se afirma nada ante un resultado
 * incierto.
 */
export function MoneyDialog({
  title,
  description,
  open,
  onClose,
  onDone,
  intentKeys,
  inputSignature,
  formValid,
  preview,
  submit,
  submitLabel,
  submitTone = 'primary',
  returnFocusRef,
  children,
  extraNotice,
}: {
  title: string
  description: string
  open: boolean
  onClose: () => void
  onDone: () => void
  /** Claves de sessionStorage cuyas intenciones se resuelven al terminar. */
  intentKeys: string[]
  /** Cambia cuando cambia el contenido: la revisión anterior deja de ser vigente. */
  inputSignature: string
  formValid: boolean
  preview: () => Promise<MoneyReview>
  submit: (reviewToken: string, key: string) => Promise<unknown>
  submitLabel: string
  submitTone?: 'primary' | 'danger'
  returnFocusRef?: RefObject<HTMLElement | null>
  children: ReactNode
  extraNotice?: ReactNode
}) {
  const latest = useLatestReview<MoneyReview>()
  const tracker = useIntentTracker()
  const [problem, setProblem] = useState<ProblemView | null>(null)
  const [pending, setPending] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [statusId, setStatusId] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)
  const initialKey = useRef<string | null>(null)
  const status = useOperationStatus(statusId)
  const { invalidate } = latest

  useEffect(() => {
    if (!open) return
    // Tras una recarga puede existir una intención sin resolver: se consulta su UUID
    // antes de ofrecer otra operación.
    const stored = intentKeys.map(peekIntent).find(Boolean) ?? null
    initialKey.current = stored
    setStatusId(stored)
    setResolved(false)
  }, [open])

  useEffect(() => {
    // Editar el contenido descarta la revisión vigente y las respuestas en vuelo.
    invalidate()
    setProblem(null)
  }, [inputSignature, invalidate])

  useEffect(() => {
    if (status.data && !resolved) {
      setResolved(true)
      intentKeys.forEach(clearIntent)
    }
  }, [status.data])

  const review = latest.review
  const busy = pending || latest.pending

  async function runPreview() {
    setProblem(null)
    intentKeys.forEach(getOrCreateIntent)
    await latest.request(preview).catch(() => null)
  }

  async function run() {
    if (!review?.review_token || pending) return
    const token = review.review_token
    setPending(true)
    setProblem(null)
    try {
      await tracker.run({ inputSignature, token }, (key) => submit(token, key))
      intentKeys.forEach(clearIntent)
      setUncertain(false)
      onDone()
    } catch (error) {
      const view = describeProblem(error)
      setProblem(view)
      setUncertain(view.uncertain)
      // Revisa de nuevo sin borrar el mensaje del rechazo.
      if (!view.uncertain) void latest.request(preview).catch(() => null)
    } finally {
      setPending(false)
    }
  }

  const pendingLookup = statusId !== null && status.isPending
  const alreadyRegistered = Boolean(status.data)
  const noResult = statusId !== null && status.isError

  return (
    <Dialog
      description={description}
      onClose={onClose}
      open={open}
      {...(returnFocusRef ? { returnFocusRef } : {})}
      title={title}
    >
      <div className="space-y-4">
        {pendingLookup && (
          <LoadingState label="Consultando si el registro anterior se guardó…" />
        )}
        {alreadyRegistered && (
          <InlineNotice title="Este registro ya se guardó" tone="success">
            <p>
              El servidor tiene registrada esta operación. No es necesario
              repetirla.
            </p>
            <div className="mt-3">
              <Button onClick={onDone} type="button">
                Ver resultado
              </Button>
            </div>
          </InlineNotice>
        )}
        {noResult && !alreadyRegistered && (
          <InlineNotice
            title="Hay un registro anterior sin resultado"
            tone="warning"
          >
            No hay resultado registrado para el intento anterior. Eso no indica
            si el dinero se entregó o no. Puede registrar el mismo hecho: se
            conserva su identidad para no duplicarlo.
          </InlineNotice>
        )}
        {!alreadyRegistered && (
          <>
            {extraNotice}
            {children}
            {problem && !uncertain && (
              <InlineNotice title="No se registró la operación" tone="danger">
                {problem.message}
              </InlineNotice>
            )}
            {uncertain && (
              <UncertainNotice
                busy={busy}
                onCheck={() => {
                  const id = intentKeys.map(peekIntent).find(Boolean) ?? null
                  setStatusId(null)
                  setTimeout(() => setStatusId(id), 0)
                }}
                onRetry={() => void run()}
              />
            )}
            {review && review.issues.length > 0 && (
              <InlineNotice title="No se puede registrar" tone="danger">
                <ul className="list-disc pl-5">
                  {review.issues.map((issue) => (
                    <li key={`${issue.field}-${issue.code}`}>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </InlineNotice>
            )}
            {latest.pending && <LoadingState label="Revisando…" />}
            {review && canDo(review) && (
              <InlineNotice title="Revisión lista" tone="success">
                La revisión coincide con los datos actuales de la venta.
                Confirme para registrar el hecho; el sistema no entrega ni
                recibe dinero por usted.
              </InlineNotice>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <Button onClick={onClose} type="button" variant="secondary">
                Cancelar
              </Button>
              <Button
                disabled={busy || !formValid}
                onClick={() => void runPreview()}
                type="button"
                variant="secondary"
              >
                Revisar
              </Button>
              <Button
                disabled={busy || !canDo(review) || !formValid}
                onClick={() => void run()}
                type="button"
                variant={submitTone}
              >
                {pending ? 'Registrando…' : submitLabel}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  )
}
