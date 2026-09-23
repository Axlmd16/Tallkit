import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider, useToast } from './Toast'

function Harness() {
  const toast = useToast()
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        onClick={() =>
          toast.success('Producto guardado', {
            href: '/products/1',
            linkLabel: 'Ver',
          })
        }
        ref={triggerRef}
        type="button"
      >
        Guardar
      </button>
      <button onClick={() => toast.info('Marca desactivada')} type="button">
        Informar
      </button>
      <button
        onClick={() => {
          toast.info('Primera')
          toast.info('Segunda')
          toast.info('Tercera')
          toast.info('Cuarta')
        }}
        type="button"
      >
        Apilar
      </button>
    </>
  )
}

function renderHarness() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  )
}

describe('Toast Tallkit', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('anuncia cortésmente, conserva el foco y ofrece el enlace Ver', () => {
    renderHarness()
    const trigger = screen.getByRole('button', { name: 'Guardar' })
    trigger.focus()
    fireEvent.click(trigger)

    expect(
      screen.getByRole('status', { name: 'Notificaciones' }),
    ).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('Producto guardado')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver' })).toHaveAttribute(
      'href',
      '/products/1',
    )
    expect(trigger).toHaveFocus()
  })

  it('se retira a los seis segundos', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: 'Informar' }))

    act(() => vi.advanceTimersByTime(5_999))
    expect(screen.getByText('Marca desactivada')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByText('Marca desactivada')).not.toBeInTheDocument()
  })

  it('pausa el tiempo con puntero o foco y continúa al salir', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    const toast = screen.getByText('Producto guardado').closest('[data-toast]')!

    act(() => vi.advanceTimersByTime(2_000))
    fireEvent.mouseEnter(toast)
    act(() => vi.advanceTimersByTime(8_000))
    expect(screen.getByText('Producto guardado')).toBeInTheDocument()
    fireEvent.mouseLeave(toast)
    act(() => vi.advanceTimersByTime(3_999))
    expect(screen.getByText('Producto guardado')).toBeInTheDocument()

    fireEvent.focus(screen.getByRole('link', { name: 'Ver' }))
    act(() => vi.advanceTimersByTime(2_000))
    expect(screen.getByText('Producto guardado')).toBeInTheDocument()
    fireEvent.blur(screen.getByRole('link', { name: 'Ver' }))
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByText('Producto guardado')).not.toBeInTheDocument()
  })

  it('cierra con Escape y con el botón', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    fireEvent.keyDown(screen.getByText('Producto guardado'), { key: 'Escape' })
    expect(screen.queryByText('Producto guardado')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Informar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }))
    expect(screen.queryByText('Marca desactivada')).not.toBeInTheDocument()
  })

  it('mantiene como máximo tres y coloca la más reciente al final', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: 'Apilar' }))
    const region = screen.getByRole('status', { name: 'Notificaciones' })
    expect(region.querySelectorAll('[data-toast]')).toHaveLength(3)
    expect(screen.queryByText('Primera')).not.toBeInTheDocument()
    expect(
      Array.from(region.querySelectorAll('[data-toast]')).map(
        (item) => item.textContent,
      ),
    ).toEqual(['Segunda', 'Tercera', 'Cuarta'])
  })

  it('incluye una variante sin animación cuando se reduce el movimiento', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: 'Informar' }))
    expect(
      screen.getByText('Marca desactivada').closest('[data-toast]'),
    ).toHaveClass('motion-reduce:transition-none', 'motion-reduce:animate-none')
  })
})
