import { expect, it } from 'vitest'

import { emptyDraft } from './draft'

it('una venta nueva empieza al contado', () => {
  expect(emptyDraft().condition).toBe('CONTADO')
})
