import { useEffect, type KeyboardEvent, type RefObject } from 'react'

export const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

let activeModalCount = 0
let originalOverflow = ''

interface IsolationSnapshot {
  element: HTMLElement
  hadInert: boolean
  ariaHidden: string | null
}

const modalStack: HTMLElement[] = []
let isolationSnapshots: IsolationSnapshot[] = []

function restoreIsolation() {
  for (const { ariaHidden, element, hadInert } of isolationSnapshots) {
    if (hadInert) element.setAttribute('inert', '')
    else element.removeAttribute('inert')

    if (ariaHidden === null) element.removeAttribute('aria-hidden')
    else element.setAttribute('aria-hidden', ariaHidden)
  }
  isolationSnapshots = []
}

function isolateElement(element: HTMLElement) {
  isolationSnapshots.push({
    element,
    hadInert: element.hasAttribute('inert'),
    ariaHidden: element.getAttribute('aria-hidden'),
  })
  element.setAttribute('inert', '')
  element.setAttribute('aria-hidden', 'true')
}

function applyModalIsolation() {
  restoreIsolation()

  const topModal = modalStack.at(-1)
  if (!topModal || typeof document === 'undefined') return

  let current: HTMLElement | null = topModal
  while (current && current !== document.body) {
    const parent: HTMLElement | null = current.parentElement
    if (!parent) break

    for (const sibling of Array.from(parent.children)) {
      if (sibling !== current && sibling instanceof HTMLElement) {
        isolateElement(sibling)
      }
    }
    current = parent
  }
}

function registerModal(element: HTMLElement) {
  modalStack.push(element)
  applyModalIsolation()
}

function unregisterModal(element: HTMLElement) {
  const index = modalStack.lastIndexOf(element)
  if (index !== -1) modalStack.splice(index, 1)
  applyModalIsolation()
}

export function lockScroll() {
  if (typeof document === 'undefined') return
  if (activeModalCount === 0) {
    originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  activeModalCount++
}

export function unlockScroll() {
  if (typeof document === 'undefined') return
  activeModalCount = Math.max(0, activeModalCount - 1)
  if (activeModalCount === 0) {
    document.body.style.overflow = originalOverflow
  }
}

export function trapFocus(
  event: KeyboardEvent<HTMLElement>,
  container: HTMLElement | null,
) {
  if (event.key !== 'Tab' || !container) return

  const controls = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  )

  if (controls.length === 0) {
    event.preventDefault()
    return
  }

  const first = controls[0]!
  const last = controls.at(-1)!

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

export function useModalOpen({
  containerRef,
  open,
  returnFocusRef,
}: {
  containerRef: RefObject<HTMLElement | null>
  open: boolean
  returnFocusRef?: RefObject<HTMLElement | null> | undefined
}) {
  useEffect(() => {
    if (open) {
      lockScroll()
      const container = containerRef.current
      if (container) registerModal(container)
      const frame = requestAnimationFrame(() => {
        if (!containerRef.current) return
        const preferred =
          containerRef.current.querySelector<HTMLElement>('[data-autofocus]')
        const first =
          preferred ??
          containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
        const target = first ?? containerRef.current
        target?.focus()
      })

      return () => {
        cancelAnimationFrame(frame)
        if (container) unregisterModal(container)
        unlockScroll()
      }
    }

    returnFocusRef?.current?.focus()
  }, [open, containerRef, returnFocusRef])
}
