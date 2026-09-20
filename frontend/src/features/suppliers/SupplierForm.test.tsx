import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  matches: { data: undefined } as { data?: unknown },
  names: [] as string[],
}))

vi.mock('./hooks', () => ({
  useSupplierNameMatches: (name: string) => {
    mocks.names.push(name)
    return mocks.matches
  },
}))

import { SupplierForm } from './SupplierForm'
import type { Supplier } from './types'

const supplier: Supplier = {
  id: 3,
  name: 'Repuestos Sur',
  identification_type: 'RUC',
  identification: '0991234567001',
  phone: '0999999999',
  email: '',
  address: '',
  is_active: true,
  version: 4,
  created_at: '',
  updated_at: '',
}

beforeEach(() => {
  mocks.matches = { data: undefined }
  mocks.names.length = 0
})

it('registra un proveedor solo con nombre, sin documento ni contactos', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<SupplierForm onCancel={vi.fn()} onSubmit={onSubmit} />)
  expect(screen.getByText(/identificación \(opcional\)/i)).toBeInTheDocument()
  expect(screen.getByText(/contacto \(opcional\)/i)).toBeInTheDocument()

  await user.type(
    screen.getByLabelText(/nombre o razón social/i),
    '  Juan Pérez ',
  )
  await user.click(screen.getByRole('button', { name: /guardar proveedor/i }))
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Juan Pérez' }),
  )
})

it('exige el par tipo/documento completo y respeta 10 y 13 caracteres', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<SupplierForm onCancel={vi.fn()} onSubmit={onSubmit} />)
  await user.type(screen.getByLabelText(/nombre o razón social/i), 'Proveedor')
  await user.selectOptions(
    screen.getByLabelText(/tipo de identificación/i),
    'CI',
  )
  await user.click(screen.getByRole('button', { name: /guardar proveedor/i }))
  expect(
    await screen.findByText(/indique el tipo y el número/i),
  ).toBeInTheDocument()

  await user.type(screen.getByLabelText(/número de identificación/i), '09123')
  await user.click(screen.getByRole('button', { name: /guardar proveedor/i }))
  expect(
    await screen.findByText(/debe tener exactamente 10 caracteres/i),
  ).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()

  await user.type(screen.getByLabelText(/número de identificación/i), '45678')
  await user.click(screen.getByRole('button', { name: /guardar proveedor/i }))
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Proveedor',
      identification_type: 'CI',
      identification: '0912345678',
    }),
  )
})

it('quitar la identificación borra el par completo al guardar', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(
    <SupplierForm onCancel={vi.fn()} onSubmit={onSubmit} supplier={supplier} />,
  )
  await user.click(
    screen.getByRole('button', { name: /quitar identificación/i }),
  )
  await user.click(screen.getByRole('button', { name: /guardar cambios/i }))
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({
      identification_type: null,
      identification: null,
    }),
  )
})

it('valida el correo opcional sin bloquear su ausencia', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<SupplierForm onCancel={vi.fn()} onSubmit={onSubmit} />)
  await user.type(screen.getByLabelText(/nombre o razón social/i), 'P')
  await user.type(screen.getByLabelText(/correo electrónico/i), 'no-es-correo')
  await user.click(screen.getByRole('button', { name: /guardar proveedor/i }))
  expect(
    await screen.findByText(/correo electrónico válido/i),
  ).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()
})

it('advierte de nombres coincidentes sin impedir guardar', async () => {
  mocks.matches = {
    data: {
      results: [{ id: 9, name: 'Repuestos Sur', is_active: false }],
      has_more: true,
    },
  }
  const user = userEvent.setup()
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<SupplierForm onCancel={vi.fn()} onSubmit={onSubmit} />)
  await user.type(
    screen.getByLabelText(/nombre o razón social/i),
    'Repuestos Sur',
  )
  expect(
    screen.getByText(/ya existen proveedores con ese nombre/i),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/repuestos sur \(inactivo\) y más/i),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /guardar proveedor/i }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalled())
})

it('no persiste el borrador ni datos de contacto en el almacenamiento del navegador', async () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem')
  const user = userEvent.setup()
  render(<SupplierForm onCancel={vi.fn()} onSubmit={vi.fn()} />)
  await user.type(screen.getByLabelText(/nombre o razón social/i), 'Ana')
  await user.type(screen.getByLabelText(/teléfono/i), '0999999999')
  await user.type(
    screen.getByLabelText(/correo electrónico/i),
    'ana@example.com',
  )
  expect(setItem).not.toHaveBeenCalled()
})
