import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/ui'

const mocks = vi.hoisted(() => ({
  settings: undefined as unknown,
  save: { mutateAsync: vi.fn() },
}))

vi.mock('../hooks', () => ({
  useWithholdingSettings: () => ({
    data: mocks.settings,
    isLoading: false,
    isError: false,
  }),
  useFiscalMutations: () => ({ saveWithholdingSettings: mocks.save }),
}))

import { WithholdingSettingsBlock } from './WithholdingSettingsBlock'

const show = () =>
  render(
    <ToastProvider>
      <WithholdingSettingsBlock entityId={2} />
    </ToastProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  mocks.settings = {
    entity_id: 2,
    version: 0,
    registration_enabled: true,
    warning_percentage: '20.00',
  }
  mocks.save.mutateAsync.mockResolvedValue({})
})

it('muestra los ajustes vigentes de la entidad en lenguaje llano', () => {
  show()
  const block = screen.getByRole('group', {
    name: 'Retenciones que le hacen sus clientes',
  })
  expect(within(block).getByText('Activado')).toBeInTheDocument()
  expect(within(block).getByText('20.00 % del total')).toBeInTheDocument()
})

it('desactiva el registro y el aviso con la versión esperada', async () => {
  const user = userEvent.setup()
  show()
  await user.click(screen.getByRole('button', { name: 'Editar' }))
  const dialog = screen.getByRole('dialog')
  await user.click(
    within(dialog).getByRole('checkbox', {
      name: /Registrar retenciones al cobrar/,
    }),
  )
  await user.click(
    within(dialog).getByRole('checkbox', {
      name: /Avisar de valores inusuales/,
    }),
  )
  expect(
    within(dialog).queryByLabelText(
      'Avisar si supera este porcentaje del total',
    ),
  ).toBeNull()
  await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
  await waitFor(() => expect(mocks.save.mutateAsync).toHaveBeenCalled())
  expect(mocks.save.mutateAsync.mock.calls[0]?.[0]).toMatchObject({
    entityId: 2,
    data: {
      expected_version: 0,
      registration_enabled: false,
      warning_percentage: null,
    },
  })
})

it('rechaza un porcentaje fuera de rango antes de enviar', async () => {
  const user = userEvent.setup()
  show()
  await user.click(screen.getByRole('button', { name: 'Editar' }))
  const dialog = screen.getByRole('dialog')
  const field = within(dialog).getByLabelText(
    'Avisar si supera este porcentaje del total',
  )
  await user.clear(field)
  await user.type(field, '150')
  expect(
    within(dialog).getByText(/mayor que 0 y hasta 100/),
  ).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled()
  await user.clear(field)
  await user.type(field, '12.5')
  await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
  await waitFor(() => expect(mocks.save.mutateAsync).toHaveBeenCalled())
  expect(
    mocks.save.mutateAsync.mock.calls[0]?.[0].data.warning_percentage,
  ).toBe('12.5')
})

it('una entidad sin registro lo muestra desactivado y sin aviso', () => {
  mocks.settings = {
    entity_id: 2,
    version: 3,
    registration_enabled: false,
    warning_percentage: null,
  }
  show()
  expect(screen.getByText('Desactivado')).toBeInTheDocument()
  expect(screen.getByText('Sin aviso')).toBeInTheDocument()
})
