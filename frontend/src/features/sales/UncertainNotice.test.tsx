import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { UncertainNotice } from './UncertainNotice'

it('no afirma que el dinero no se entregó y permite consultar o reintentar el mismo hecho', async () => {
  const onCheck = vi.fn()
  const onRetry = vi.fn()
  render(<UncertainNotice onCheck={onCheck} onRetry={onRetry} />)
  const text = screen.getByText(/No sabemos si el registro llegó a guardarse/)
  expect(text).toHaveTextContent('no indica si el dinero se entregó o no')
  expect(document.body).not.toHaveTextContent(
    /no se entregó el dinero|el dinero no fue entregado/i,
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Consultar estado' }),
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Reintentar el mismo registro' }),
  )
  expect(onCheck).toHaveBeenCalledTimes(1)
  expect(onRetry).toHaveBeenCalledTimes(1)
})
