import { expect, it } from 'vitest'

import { ProblemError } from '@/shared/api/client'

import { describeProblem } from './problem'

it('convierte errores por campo y conserva el mensaje del servidor', () => {
  const view = describeProblem(
    new ProblemError('Código duplicado.', 409, 'duplicate_code', 'r1', {
      code: ['Ya existe un producto con ese código.'],
    }),
  )
  expect(view.fields).toEqual({ code: 'Ya existe un producto con ese código.' })
  expect(view.message).toBe('Código duplicado.')
  expect(view.uncertain).toBe(false)
})

it('explica la versión obsoleta y la baja bloqueada de categorías', () => {
  const stale = describeProblem(
    new ProblemError('Registro desactualizado.', 409, 'stale_record'),
  )
  expect(stale.staleRecord).toBe(true)
  expect(stale.message).toMatch(/no se sobrescribe/)
  expect(
    describeProblem(
      new ProblemError('Tiene productos.', 409, 'category_has_active_products'),
    ).message,
  ).toMatch(/Reclasifique o desactive/)
})

it('marca como incierto un fallo de red y no lo presenta como éxito', () => {
  const view = describeProblem(new ProblemError('x', 0, 'network_error'))
  expect(view.uncertain).toBe(true)
  expect(view.message).toMatch(/sin duplicarla/)
})
