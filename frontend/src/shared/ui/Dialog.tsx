import { Wrench } from '@phosphor-icons/react'
import confirmBg from '@/assets/figma/confirm-bg.svg'
import confirmHand from '@/assets/figma/confirm-hand.svg'
import confirmSpark from '@/assets/figma/confirm-spark.svg'
import {
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'

import { trapFocus, useModalOpen } from './overlays/modal-utils'

export function Dialog({
  children,
  description,
  onClose,
  open,
  returnFocusRef,
  title,
  appearance = 'default',
}: {
  children: ReactNode
  description: string
  onClose: () => void
  open: boolean
  returnFocusRef?: RefObject<HTMLElement | null>
  title: string
  appearance?: 'default' | 'recover' | 'confirm'
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useModalOpen({
    containerRef: dialogRef,
    open,
    returnFocusRef,
  })

  if (!open) return null

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    trapFocus(event, dialogRef.current)
  }

  return (
    <div
      className={`dialog-backdrop dialog-backdrop-${appearance} fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/35 p-4 sm:p-6`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`dialog-panel dialog-${appearance} max-h-[min(90vh,50rem)] w-full max-w-lg overflow-y-auto rounded-dialog bg-surface p-5 text-ink shadow-overlay sm:p-7`}
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {appearance === 'recover' && (
          <span className="auth-logo" aria-hidden="true">
            <Wrench size={46} weight="bold" />
          </span>
        )}
        {appearance === 'confirm' && (
          <div className="confirm-illustration" aria-hidden="true">
            <img alt="" src={confirmBg} />
            <img alt="" src={confirmHand} />
            <img alt="" src={confirmSpark} />
          </div>
        )}
        <h2 className="text-xl font-extrabold" id={titleId}>
          {title}
        </h2>
        <p className="mt-2 text-ink-muted" id={descriptionId}>
          {description}
        </p>
        <div className="dialog-actions mt-6 flex flex-wrap justify-end gap-2">
          {children}
        </div>
      </div>
    </div>
  )
}
