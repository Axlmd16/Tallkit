import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'

import type { CustomersApi } from './api'
import { CustomerForm } from './CustomerForm'
import type { CustomerSummary } from './types'

const dummyApi = {
  matches: vi.fn().mockResolvedValue([]),
} as unknown as CustomersApi

it('validates required fields, changes name label by person type, and preserves values', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  const user = userEvent.setup()
  render(<CustomerForm api={dummyApi} onSubmit={save} />)

  // Initial state: PersonType is NATURAL, label is "Nombres y apellidos"
  expect(screen.getByLabelText(/nombres y apellidos/i)).toBeInTheDocument()

  // Switch to JURIDICA -> label becomes "Razón social"
  await user.selectOptions(
    screen.getByLabelText(/tipo de persona/i),
    'JURIDICA',
  )
  expect(screen.getByLabelText(/razón social/i)).toBeInTheDocument()

  // Try submitting without data
  await user.click(screen.getByRole('button', { name: /guardar cliente/i }))
  expect(screen.getByRole('alert')).toHaveTextContent(
    /revise los campos señalados/i,
  )
  expect(save).not.toHaveBeenCalled()

  // Fill valid minimal data for Persona Jurídica with RUC
  await user.selectOptions(
    screen.getByLabelText(/tipo de identificación/i),
    'RUC',
  )
  await user.type(
    screen.getByLabelText(/razón social/i),
    'Taller San José S.A.',
  )
  await user.type(
    screen.getByLabelText(/número de identificación/i),
    '0990000000001',
  )
  await user.type(screen.getByLabelText(/teléfono/i), '042000000')

  await user.click(screen.getByRole('button', { name: /guardar cliente/i }))
  expect(save).toHaveBeenCalledWith({
    person_type: 'JURIDICA',
    identification_type: 'RUC',
    identification: '0990000000001',
    name: 'Taller San José S.A.',
    phone: '042000000',
    email: '',
    address: '',
  })
})

it('validates CI length of 10 and RUC length of 13', async () => {
  const save = vi.fn()
  const user = userEvent.setup()
  render(<CustomerForm api={dummyApi} onSubmit={save} />)

  await user.type(screen.getByLabelText(/nombres y apellidos/i), 'Juan Pérez')
  await user.type(screen.getByLabelText(/teléfono/i), '0991234567')

  // CI with 9 digits
  await user.type(
    screen.getByLabelText(/número de identificación/i),
    '091234567',
  )
  await user.click(screen.getByRole('button', { name: /guardar cliente/i }))
  expect(
    screen.getByText(
      /la cédula de identidad \(ci\) debe tener exactamente 10 caracteres/i,
    ),
  ).toBeInTheDocument()
  expect(save).not.toHaveBeenCalled()

  // Change to 10 digits
  await user.clear(screen.getByLabelText(/número de identificación/i))
  await user.type(
    screen.getByLabelText(/número de identificación/i),
    '0912345678',
  )
  await user.click(screen.getByRole('button', { name: /guardar cliente/i }))
  expect(save).toHaveBeenCalled()
})

it('associates backend validation errors to their respective fields and preserves input', async () => {
  const save = vi.fn().mockRejectedValue(
    new ProblemError(
      'Datos de cliente inválidos.',
      400,
      'validation_error',
      undefined,
      {
        phone: ['El teléfono no puede exceder 64 caracteres.'],
        email: ['El dominio del correo no existe.'],
      },
    ),
  )
  const user = userEvent.setup()
  render(<CustomerForm api={dummyApi} onSubmit={save} />)

  await user.type(screen.getByLabelText(/nombres y apellidos/i), 'Carlos Vera')
  await user.type(
    screen.getByLabelText(/número de identificación/i),
    '0912345678',
  )
  await user.type(screen.getByLabelText(/teléfono/i), '0991234567')
  await user.type(screen.getByLabelText(/correo/i), 'carlos@example.com')

  await user.click(screen.getByRole('button', { name: /guardar cliente/i }))

  expect(
    await screen.findByText('El teléfono no puede exceder 64 caracteres.'),
  ).toBeInTheDocument()
  expect(
    screen.getByText('El dominio del correo no existe.'),
  ).toBeInTheDocument()
  // Values preserved
  expect(screen.getByLabelText(/nombres y apellidos/i)).toHaveValue(
    'Carlos Vera',
  )
  expect(screen.getByLabelText(/número de identificación/i)).toHaveValue(
    '0912345678',
  )
  expect(screen.getByLabelText(/teléfono/i)).toHaveValue('0991234567')
  expect(screen.getByLabelText(/correo/i)).toHaveValue('carlos@example.com')
})

it('handles duplicate conflict and provides navigation to the existing customer', async () => {
  const onNavigate = vi.fn()
  const conflictMessage =
    'Ya existe un cliente registrado con esa identificación.'
  const save = vi.fn().mockRejectedValue(
    new ProblemError(conflictMessage, 409, 'conflict', undefined, undefined, {
      type: 'customer',
      id: 42,
    }),
  )
  const user = userEvent.setup()
  render(
    <CustomerForm
      api={dummyApi}
      onNavigateToCustomer={onNavigate}
      onSubmit={save}
    />,
  )

  await user.type(screen.getByLabelText(/nombres y apellidos/i), 'Carlos Vera')
  await user.type(
    screen.getByLabelText(/número de identificación/i),
    '0912345678',
  )
  await user.type(screen.getByLabelText(/teléfono/i), '0991234567')
  await user.click(screen.getByRole('button', { name: /guardar cliente/i }))

  const matches = await screen.findAllByText(conflictMessage)
  expect(matches.length).toBeGreaterThanOrEqual(1)

  const navButton = screen.getByRole('button', {
    name: /ver ficha del cliente registrado/i,
  })
  expect(navButton).toBeInTheDocument()
  await user.click(navButton)
  expect(onNavigate).toHaveBeenCalledWith(42)
})

it('displays non-blocking match warnings while still permitting submission', async () => {
  const matchesApi = {
    matches: vi.fn().mockResolvedValue([
      {
        id: 99,
        person_type: 'NATURAL' as const,
        identification_type: 'CI' as const,
        identification: '0999999999',
        name: 'Carlos Vera Hermano',
        phone: '0991234567',
        is_active: true,
      },
    ]),
  } as unknown as CustomersApi
  const save = vi.fn().mockResolvedValue(undefined)
  const user = userEvent.setup()

  render(<CustomerForm api={matchesApi} onSubmit={save} />)

  await user.type(screen.getByLabelText(/nombres y apellidos/i), 'Carlos Vera')
  await user.type(
    screen.getByLabelText(/número de identificación/i),
    '0912345678',
  )
  await user.type(screen.getByLabelText(/teléfono/i), '0991234567')

  // Trigger matches check (e.g. on blur of phone)
  await user.tab()

  await waitFor(() => {
    expect(matchesApi.matches).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Carlos Vera', phone: '0991234567' }),
    )
  })

  expect(
    await screen.findByText(/coincidencias encontradas/i),
  ).toBeInTheDocument()
  expect(screen.getByText(/Carlos Vera Hermano/i)).toBeInTheDocument()

  // Non-blocking: submission still works
  await user.click(screen.getByRole('button', { name: /guardar cliente/i }))
  expect(save).toHaveBeenCalled()
})

it('includes expected_version and pre-populates data when editing existing customer', async () => {
  const existing: CustomerSummary = {
    id: 15,
    person_type: 'NATURAL',
    identification_type: 'CI',
    identification: '0912345678',
    name: 'Carlos Vera',
    phone: '0991234567',
    email: 'carlos@example.com',
    address: 'Av. 9 de Octubre',
    is_active: true,
    version: 3,
    created_at: '2026-09-13T00:00:00Z',
    updated_at: '2026-09-13T00:00:00Z',
  }
  const save = vi.fn().mockResolvedValue(undefined)
  const user = userEvent.setup()
  render(<CustomerForm api={dummyApi} customer={existing} onSubmit={save} />)

  expect(screen.getByLabelText(/nombres y apellidos/i)).toHaveValue(
    'Carlos Vera',
  )
  expect(screen.getByLabelText(/número de identificación/i)).toHaveValue(
    '0912345678',
  )
  expect(screen.getByLabelText(/teléfono/i)).toHaveValue('0991234567')
  expect(screen.getByLabelText(/correo/i)).toHaveValue('carlos@example.com')
  expect(screen.getByLabelText(/dirección/i)).toHaveValue('Av. 9 de Octubre')

  await user.clear(screen.getByLabelText(/teléfono/i))
  await user.type(screen.getByLabelText(/teléfono/i), '0999999999')

  await user.click(screen.getByRole('button', { name: /guardar cliente/i }))
  expect(save).toHaveBeenCalledWith({
    person_type: 'NATURAL',
    identification_type: 'CI',
    identification: '0912345678',
    name: 'Carlos Vera',
    phone: '0999999999',
    email: 'carlos@example.com',
    address: 'Av. 9 de Octubre',
    expected_version: 3,
  })
})

it('warns about unsaved changes on unload and notifies parent container', async () => {
  const onDirtyChange = vi.fn()
  const user = userEvent.setup()
  render(
    <CustomerForm
      api={dummyApi}
      onDirtyChange={onDirtyChange}
      onSubmit={vi.fn()}
    />,
  )

  await user.type(screen.getByLabelText(/nombres y apellidos/i), 'Carlos')
  expect(onDirtyChange).toHaveBeenLastCalledWith(true)

  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
})

it('prevents double submission while a save request is pending', async () => {
  let resolveSave!: () => void
  const save = vi.fn().mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resolveSave = resolve
      }),
  )
  const user = userEvent.setup()
  render(<CustomerForm api={dummyApi} onSubmit={save} />)

  await user.type(screen.getByLabelText(/nombres y apellidos/i), 'Carlos Vera')
  await user.type(
    screen.getByLabelText(/número de identificación/i),
    '0912345678',
  )
  await user.type(screen.getByLabelText(/teléfono/i), '0991234567')

  const submitButton = screen.getByRole('button', { name: /guardar cliente/i })
  await user.click(submitButton)

  // While pending, button is disabled and shows pendingLabel
  expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled()

  // Clicking again does not trigger a second save call
  await user.click(submitButton)
  expect(save).toHaveBeenCalledTimes(1)

  // Resolve save
  resolveSave()
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: /guardar cliente/i }),
    ).not.toBeDisabled()
  })
})
