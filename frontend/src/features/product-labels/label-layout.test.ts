import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LABEL_HEIGHT_MM,
  DEFAULT_LABEL_WIDTH_MM,
  LabelLayoutError,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  buildLabelPages,
  calculateLabelGrid,
  validateLabelComposition,
  type ProductLabelData,
} from './label-layout'

const product = (id: number, code: string): ProductLabelData => ({
  id,
  code,
  name: `Producto ${code}`,
  manufacturerCode: null,
  productBrand: null,
})

describe('calculateLabelGrid', () => {
  it('distribuye el tamaño predeterminado en 3 × 7 y centra la cuadrícula', () => {
    expect(PAGE_WIDTH_MM).toBe(210)
    expect(PAGE_HEIGHT_MM).toBe(297)
    expect(DEFAULT_LABEL_WIDTH_MM).toBe(63)
    expect(DEFAULT_LABEL_HEIGHT_MM).toBe(38)

    expect(calculateLabelGrid(63, 38)).toEqual({
      pageWidthMm: 210,
      pageHeightMm: 297,
      labelWidthMm: 63,
      labelHeightMm: 38,
      columns: 3,
      rows: 7,
      capacity: 21,
      offsetXmm: 10.5,
      offsetYmm: 15.5,
    })
  })

  it('acepta dimensiones decimales y conserva las medidas exteriores', () => {
    const grid = calculateLabelGrid(52.5, 29.7)

    expect(grid).toMatchObject({
      labelWidthMm: 52.5,
      labelHeightMm: 29.7,
      columns: 4,
      rows: 10,
      capacity: 40,
      offsetXmm: 0,
      offsetYmm: 0,
    })
  })

  it.each([
    [0, 38],
    [-1, 38],
    [Number.NaN, 38],
    [Number.POSITIVE_INFINITY, 38],
    [211, 38],
    [63, 298],
  ])('rechaza un tamaño inválido %s × %s', (width, height) => {
    expect(() => calculateLabelGrid(width, height)).toThrowError(
      LabelLayoutError,
    )
  })
})

describe('buildLabelPages', () => {
  const grid = calculateLabelGrid(63, 38)

  it('mantiene el orden de productos y agrupa sus copias', () => {
    const result = buildLabelPages(
      [
        { product: product(1, 'A'), quantity: 2 },
        { product: product(2, 'B'), quantity: 1 },
      ],
      grid,
      1,
    )

    expect(result.totalLabels).toBe(3)
    expect(result.startPosition).toBe(1)
    expect(result.pages).toHaveLength(1)
    expect(result.pages[0]?.slice(0, 4)).toEqual([
      { product: product(1, 'A'), copyIndex: 1 },
      { product: product(1, 'A'), copyIndex: 2 },
      { product: product(2, 'B'), copyIndex: 1 },
      null,
    ])
    expect(result.pages[0]).toHaveLength(21)
  })

  it('deja vacías solo las posiciones anteriores al inicio de la primera hoja', () => {
    const result = buildLabelPages(
      [{ product: product(1, 'A'), quantity: 20 }],
      grid,
      8,
    )

    expect(result.pages).toHaveLength(2)
    expect(result.pages[0]?.slice(0, 7)).toEqual(Array(7).fill(null))
    expect(result.pages[0]?.filter(Boolean)).toHaveLength(14)
    expect(result.pages[1]?.[0]).toEqual({
      product: product(1, 'A'),
      copyIndex: 15,
    })
    expect(result.pages[1]?.filter(Boolean)).toHaveLength(6)
  })

  it('reinicia una posición que ya no existe y conserva las cantidades', () => {
    const smallerGrid = calculateLabelGrid(105, 99)
    const result = buildLabelPages(
      [{ product: product(1, 'A'), quantity: 7 }],
      smallerGrid,
      8,
    )

    expect(smallerGrid.capacity).toBe(6)
    expect(result.startPosition).toBe(1)
    expect(result.didResetStartPosition).toBe(true)
    expect(result.totalLabels).toBe(7)
    expect(result.pages).toHaveLength(2)
    expect(result.pages[1]?.[0]).toEqual({
      product: product(1, 'A'),
      copyIndex: 7,
    })
  })

  it('no crea páginas para un lote sin copias', () => {
    expect(
      buildLabelPages([{ product: product(1, 'A'), quantity: 0 }], grid, 1),
    ).toMatchObject({ pages: [], totalLabels: 0 })
  })
})

describe('validateLabelComposition', () => {
  it('acepta el tamaño predeterminado y el mínimo legible', () => {
    expect(validateLabelComposition(63, 38)).toEqual({ valid: true })
    expect(validateLabelComposition(40, 25)).toEqual({ valid: true })
  })

  it('bloquea tamaños que no contienen identidad, código y barras legibles', () => {
    expect(validateLabelComposition(39.9, 25)).toMatchObject({ valid: false })
    expect(validateLabelComposition(40, 24.9)).toMatchObject({ valid: false })
    expect(validateLabelComposition(Number.NaN, 25)).toMatchObject({
      valid: false,
    })
  })
})
