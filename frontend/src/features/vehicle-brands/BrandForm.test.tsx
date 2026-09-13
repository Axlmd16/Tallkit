import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

import { BrandForm } from './BrandForm'
import type { VehicleBrandSummary } from './types'

describe('BrandForm', () => {
  it('renders form fields for brand creation', () => {
    render(<BrandForm onCancel={vi.fn()} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/nombre de la marca/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /guardar marca/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /cancelar/i }),
    ).toBeInTheDocument()
  })

  it('prepopulates form for editing existing brand', () => {
    const brand: VehicleBrandSummary = {
      id: 1,
      name: 'Toyota',
      is_active: true,
      version: 1,
      created_at: '2026-09-13T00:00:00Z',
      updated_at: '2026-09-13T00:00:00Z',
    }

    render(<BrandForm brand={brand} onCancel={vi.fn()} onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/nombre de la marca/i)).toHaveValue('Toyota')
    expect(
      screen.getByRole('button', { name: /guardar cambios/i }),
    ).toBeInTheDocument()
  })

  it('validates required name field before submission', async () => {
    const onSubmit = vi.fn()
    render(<BrandForm onCancel={vi.fn()} onSubmit={onSubmit} />)

    const input = screen.getByLabelText(/nombre de la marca/i)
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar marca/i }))

    expect(
      await screen.findByText(/el nombre de la marca es obligatorio/i),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits valid data with trimmed name', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<BrandForm onCancel={vi.fn()} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/nombre de la marca/i), {
      target: { value: '  Nissan  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar marca/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Nissan',
        expected_version: undefined,
      })
    })
  })

  it('submits with expected_version when editing', async () => {
    const brand: VehicleBrandSummary = {
      id: 2,
      name: 'Honda',
      is_active: true,
      version: 3,
      created_at: '2026-09-13T00:00:00Z',
      updated_at: '2026-09-13T00:00:00Z',
    }
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<BrandForm brand={brand} onCancel={vi.fn()} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/nombre de la marca/i), {
      target: { value: 'Honda Motors' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Honda Motors',
        expected_version: 3,
      })
    })
  })

  it('handles remote ProblemError validation and stale_record', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new ProblemError('Versión obsoleta.', 409, 'stale_record'),
      )

    render(<BrandForm onCancel={vi.fn()} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/nombre de la marca/i), {
      target: { value: 'Mazda' },
    })
    fireEvent.click(screen.getByRole('button', { name: /guardar marca/i }))

    expect(await screen.findByText(/versión obsoleta/i)).toBeInTheDocument()
  })

  it('tracks dirty changes and notifies onDirtyChange', () => {
    const onDirtyChange = vi.fn()
    render(
      <BrandForm
        onCancel={vi.fn()}
        onDirtyChange={onDirtyChange}
        onSubmit={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText(/nombre de la marca/i), {
      target: { value: 'Hyundai' },
    })
    expect(onDirtyChange).toHaveBeenCalledWith(true)

    fireEvent.change(screen.getByLabelText(/nombre de la marca/i), {
      target: { value: '' },
    })
    expect(onDirtyChange).toHaveBeenCalledWith(false)
  })
})
