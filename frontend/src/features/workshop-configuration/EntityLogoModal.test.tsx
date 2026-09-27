import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { ProblemError } from '@/shared/api/client'
import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn() }))
vi.mock('./queries', () => ({
  useUploadEntityLogo: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}))

import { EntityLogoModal } from './EntityLogoModal'
import type { FiscalEntity } from './types'

const entity: FiscalEntity = {
  id: 2,
  entity_type: 'COMERCIAL',
  ruc: '1150696977001',
  legal_name: 'Repuestos VVH',
  trade_name: null,
  address: null,
  phone: null,
  email: null,
  version: 3,
  logo: null,
}

const onClose = vi.fn()

function renderModal() {
  return render(
    <ToastProvider>
      <EntityLogoModal entity={entity} onClose={onClose} open />
    </ToastProvider>,
  )
}

function png(name = 'logo.png') {
  return new File(['png'], name, { type: 'image/png' })
}

beforeEach(() => {
  vi.clearAllMocks()
  let counter = 0
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:vista-${++counter}`),
    revokeObjectURL: vi.fn(),
  }))
  mocks.mutateAsync.mockResolvedValue({ ...entity, logo: {} })
})

afterEach(() => vi.unstubAllGlobals())

function fileInput() {
  return screen.getByLabelText(/Imagen del logo/) as HTMLInputElement
}

it('acepta solo PNG, JPEG y WebP y muestra la vista previa del archivo elegido', async () => {
  const user = userEvent.setup()
  renderModal()
  const dialog = screen.getByRole('dialog', { name: 'Logo de la entidad comercial' })
  expect(dialog).toHaveTextContent('Repuestos VVH')
  expect(fileInput()).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp')
  expect(within(dialog).getByRole('button', { name: 'Guardar logo' })).toBeDisabled()

  await user.upload(fileInput(), png())

  expect(within(dialog).getByRole('img', { name: 'Vista previa del logo' })).toHaveAttribute(
    'src',
    'blob:vista-1',
  )
  expect(within(dialog).getByRole('button', { name: 'Guardar logo' })).toBeEnabled()
})

it('explica formatos y límites en un aviso desplegable', async () => {
  const user = userEvent.setup()
  renderModal()
  await user.click(screen.getByRole('button', { name: 'Formatos admitidos' }))
  expect(await screen.findByText(/PNG, JPEG o WebP/)).toBeVisible()
  expect(screen.getByText(/2 MiB/)).toBeVisible()
  expect(screen.getByText(/25 megapíxeles/)).toBeVisible()
})

it('guarda, cierra y notifica con un toast', async () => {
  const user = userEvent.setup()
  renderModal()
  const file = png()
  await user.upload(fileInput(), file)
  await user.click(screen.getByRole('button', { name: 'Guardar logo' }))

  expect(mocks.mutateAsync).toHaveBeenCalledWith({
    id: 2,
    file,
    key: expect.stringMatching(/^[A-Za-z0-9._:-]{8,128}$/),
  })
  expect(await screen.findByText('Logo de la entidad comercial actualizado.')).toBeVisible()
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

it('mantiene el modal, el archivo y la clave cuando el servidor rechaza la imagen', async () => {
  const user = userEvent.setup()
  mocks.mutateAsync.mockRejectedValueOnce(
    new ProblemError('Imagen inválida', 400, 'invalid_image', undefined, {
      file: ['Suba una imagen PNG, JPEG o WebP estática y válida.'],
    }),
  )
  renderModal()
  await user.upload(fileInput(), png())
  await user.click(screen.getByRole('button', { name: 'Guardar logo' }))

  const dialog = screen.getByRole('dialog', { name: 'Logo de la entidad comercial' })
  expect(
    await within(dialog).findByText('Suba una imagen PNG, JPEG o WebP estática y válida.'),
  ).toBeVisible()
  expect(fileInput()).toHaveAttribute('aria-invalid', 'true')
  expect(within(dialog).getByRole('img', { name: 'Vista previa del logo' })).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.queryByText('Logo de la entidad comercial actualizado.')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Guardar logo' }))
  const [first, second] = mocks.mutateAsync.mock.calls.map((call) => call[0].key)
  expect(second).toBe(first)
})

it('usa una clave nueva al elegir otro archivo y libera la vista previa anterior', async () => {
  const user = userEvent.setup()
  mocks.mutateAsync.mockRejectedValueOnce(new ProblemError('x', 400, 'invalid_image', undefined, { file: ['x'] }))
  renderModal()
  await user.upload(fileInput(), png('uno.png'))
  await user.click(screen.getByRole('button', { name: 'Guardar logo' }))
  await screen.findByText('x')
  fireEvent.change(fileInput(), { target: { files: [png('dos.png')] } })
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:vista-1')
  await user.click(screen.getByRole('button', { name: 'Guardar logo' }))
  const [first, second] = mocks.mutateAsync.mock.calls.map((call) => call[0].key)
  expect(second).not.toBe(first)
})
