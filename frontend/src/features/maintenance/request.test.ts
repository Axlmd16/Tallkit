import { expect, it } from 'vitest'

import { requestNotes, splitRequest } from './request'

it('los motivos elegidos viajan a las observaciones y se recuperan', () => {
  const notes = requestNotes(['Frenos', 'Ruido extraño'])
  expect(notes).toBe('Pide el cliente: Frenos, Ruido extraño.')
  expect(splitRequest(notes)).toEqual({
    chips: ['Frenos', 'Ruido extraño'],
    text: '',
  })
})

it('conserva el texto libre escrito después de los motivos', () => {
  expect(
    splitRequest('Pide el cliente: Frenos.\nChilla al frenar en bajada.'),
  ).toEqual({ chips: ['Frenos'], text: 'Chilla al frenar en bajada.' })
})

it('unas observaciones sin la frase son texto libre y sin motivos no se escribe nada', () => {
  expect(splitRequest('Trae repuestos propios.')).toEqual({
    chips: [],
    text: 'Trae repuestos propios.',
  })
  expect(requestNotes([])).toBe('')
})
