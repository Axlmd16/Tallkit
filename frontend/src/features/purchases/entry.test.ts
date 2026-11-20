import { describe, expect, it } from 'vitest'

import {
  addProduct,
  changeQuantity,
  costTotal,
  lineSubtotal,
  emptyDraft,
  hasOptionalDetails,
  isDirty,
  removeLine,
  setCost,
  setQuantity,
  summarize,
  toInput,
  validateDraft,
  type EntryDraft,
} from './entry'

const oil = { id: 1, code: 'ACE-1', name: 'Aceite 20W50', unit: 'Galón' }
const filter = { id: 2, code: 'FIL-1', name: 'Filtro', unit: 'Unidad' }

function draftWith(
  lines = addProduct([], oil),
  extra: Partial<EntryDraft> = {},
) {
  return { ...emptyDraft(), lines, ...extra }
}

describe('líneas de la entrada', () => {
  it('un producto nuevo entra con cantidad 1 y sin costo', () => {
    const [line] = addProduct([], oil)
    expect(line).toMatchObject({ productId: 1, quantity: '1', cost: '' })
  })

  it('elegir de nuevo el mismo producto suma una presentación', () => {
    const lines = addProduct(addProduct([], oil), oil)
    expect(lines).toHaveLength(1)
    expect(lines[0]?.quantity).toBe('2')
  })

  it('suma sobre lo que el usuario escribió y respeta el orden', () => {
    let lines = addProduct(addProduct([], oil), filter)
    lines = setQuantity(lines, 1, '7')
    lines = addProduct(lines, oil)
    expect(lines.map((l) => [l.productId, l.quantity])).toEqual([
      [1, '8'],
      [2, '1'],
    ])
  })

  it('más y menos nunca bajan de 1', () => {
    let lines = addProduct([], oil)
    lines = changeQuantity(lines, 1, -1)
    expect(lines[0]?.quantity).toBe('1')
    lines = changeQuantity(lines, 1, +1)
    expect(lines[0]?.quantity).toBe('2')
  })

  it('quita una línea sin tocar las demás', () => {
    const lines = removeLine(addProduct(addProduct([], oil), filter), 1)
    expect(lines.map((l) => l.productId)).toEqual([2])
  })

  it('resume productos y unidades ignorando cantidades inválidas', () => {
    let lines = addProduct(addProduct([], oil), filter)
    lines = setQuantity(lines, 1, '4')
    lines = setQuantity(lines, 2, 'x')
    expect(summarize(lines)).toEqual({ products: 2, units: 4 })
  })
})

describe('validación', () => {
  it('exige al menos un producto', () => {
    expect(validateDraft(emptyDraft())).toEqual({
      lines: 'Agregue al menos un producto.',
    })
  })

  it.each(['0', '1.5', '-1', 'abc', ''])(
    'rechaza la cantidad %j',
    (quantity) => {
      const errors = validateDraft(
        draftWith(setQuantity(addProduct([], oil), 1, quantity)),
      )
      expect(errors['lines.0.quantity']).toBeTruthy()
    },
  )

  it('acepta la entrada mínima: producto y cantidad', () => {
    expect(validateDraft(draftWith())).toEqual({})
  })

  it('el costo es opcional y solo se valida si se muestra', () => {
    const lines = setCost(addProduct([], oil), 1, '1.1234567')
    expect(validateDraft(draftWith(lines, { costsOn: false }))).toEqual({})
    expect(
      validateDraft(draftWith(lines, { costsOn: true }))['lines.0.unit_cost'],
    ).toBeTruthy()
    expect(
      validateDraft(draftWith(setCost(lines, 1, ''), { costsOn: true })),
    ).toEqual({})
  })

  it('acepta costo cero explícito y hasta seis decimales', () => {
    for (const cost of ['0', '4.5', '0.335000']) {
      const lines = setCost(addProduct([], oil), 1, cost)
      expect(validateDraft(draftWith(lines, { costsOn: true }))).toEqual({})
    }
  })
})

describe('solicitud al servidor', () => {
  it('una entrada mínima solo envía producto y cantidad', () => {
    expect(toInput(draftWith())).toEqual({
      lines: [{ product_id: 1, quantity: '1' }],
    })
  })

  it('incluye lo opcional solo cuando se informó', () => {
    const draft = draftWith(setCost(addProduct([], oil), 1, '4.50'), {
      costsOn: true,
      supplier: { id: 9, label: 'Repuestos SA' },
      reference: ' F-001 ',
      observation: '  ',
    })
    expect(toInput(draft, [3])).toEqual({
      lines: [{ product_id: 1, quantity: '1', unit_cost: '4.50' }],
      supplier_id: 9,
      reference: 'F-001',
      acknowledged_entry_ids: [3],
    })
  })

  it('con costos apagados nunca envía un costo escrito antes', () => {
    const draft = draftWith(setCost(addProduct([], oil), 1, '4.50'), {
      costsOn: false,
    })
    expect(toInput(draft).lines[0]).toEqual({ product_id: 1, quantity: '1' })
  })

  it('distingue costo cero de costo ausente', () => {
    const draft = draftWith(
      setCost(addProduct(addProduct([], oil), filter), 1, '0'),
      { costsOn: true },
    )
    expect(toInput(draft).lines).toEqual([
      { product_id: 1, quantity: '1', unit_cost: '0' },
      { product_id: 2, quantity: '1' },
    ])
  })
})

describe('estado del formulario', () => {
  it('detecta lo que se perdería al salir', () => {
    expect(isDirty(emptyDraft())).toBe(false)
    expect(isDirty(draftWith())).toBe(true)
    expect(isDirty({ ...emptyDraft(), reference: 'F-1' })).toBe(true)
  })

  it('no oculta detalles opcionales que ya tienen contenido', () => {
    expect(hasOptionalDetails(emptyDraft())).toBe(false)
    expect(
      hasOptionalDetails({ ...emptyDraft(), observation: 'Llegó roto' }),
    ).toBe(true)
    expect(hasOptionalDetails({ ...emptyDraft(), costsOn: false })).toBe(true)
  })
})

describe('costo de la entrada', () => {
  const costed = (quantity: string, cost: string) => ({
    ...(addProduct([], oil)[0] as ReturnType<typeof addProduct>[number]),
    quantity,
    cost,
  })

  it('multiplica cantidad por costo sin errores de coma flotante', () => {
    expect(lineSubtotal(costed('3', '15.50'))).toBe('46.50')
    expect(lineSubtotal(costed('3', '0.1'))).toBe('0.30')
    expect(lineSubtotal(costed('7', '1.005'))).toBe('7.04')
  })

  it('una línea sin cantidad o costo válidos no tiene subtotal', () => {
    expect(lineSubtotal(costed('2', ''))).toBeNull()
    expect(lineSubtotal(costed('2', '1,5'))).toBeNull()
    expect(lineSubtotal(costed('x', '1.00'))).toBeNull()
  })

  it('el total suma las líneas con costo y cuenta las que no lo tienen, sin tomarlas como cero', () => {
    const lines = [costed('3', '15.50'), costed('2', '4.25'), costed('5', '')]
    expect(costTotal(lines, true)).toEqual({ total: '55.00', withoutCost: 1 })
  })

  it('con los costos apagados no hay total ni líneas por avisar', () => {
    expect(costTotal([costed('3', '15.50')], false)).toEqual({
      total: '0.00',
      withoutCost: 0,
    })
  })
})
