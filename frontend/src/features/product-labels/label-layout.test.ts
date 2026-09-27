import { describe, expect, it } from 'vitest'

import {
  LABEL_HEIGHT_MM,
  LABEL_WIDTH_MM,
  LabelLayoutError,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  buildLabelPages,
  calculateLabelGrid,
  type ProductLabelData,
} from './label-layout'

const product = (id: number, code: string): ProductLabelData => ({
  id,
  code,
  name: `Producto ${code}`,
  description: '',
  contentQuantity: '1.000000',
  manufacturerCode: null,
  productBrand: null,
  unit: { id: 1, name: 'Unidad' },
})

describe('calculateLabelGrid', () => {
  it('usa el tamaño fijo 100 × 55 en una cuadrícula centrada de 2 × 5', () => {
    expect(PAGE_WIDTH_MM).toBe(210)
    expect(PAGE_HEIGHT_MM).toBe(297)
    expect(LABEL_WIDTH_MM).toBe(100)
    expect(LABEL_HEIGHT_MM).toBe(55)

    expect(calculateLabelGrid(LABEL_WIDTH_MM, LABEL_HEIGHT_MM)).toEqual({
      pageWidthMm: 210,
      pageHeightMm: 297,
      labelWidthMm: 100,
      labelHeightMm: 55,
      columns: 2,
      rows: 5,
      capacity: 10,
      offsetXmm: 5,
      offsetYmm: 11,
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
  const grid = calculateLabelGrid(100, 55)

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
    expect(result.pages[0]).toHaveLength(10)
  })

  it('deja vacías solo las posiciones anteriores al inicio de la primera hoja', () => {
    const result = buildLabelPages(
      [{ product: product(1, 'A'), quantity: 12 }],
      grid,
      4,
    )

    expect(result.pages).toHaveLength(2)
    expect(result.pages[0]?.slice(0, 3)).toEqual(Array(3).fill(null))
    expect(result.pages[0]?.filter(Boolean)).toHaveLength(7)
    expect(result.pages[1]?.[0]).toEqual({
      product: product(1, 'A'),
      copyIndex: 8,
    })
    expect(result.pages[1]?.filter(Boolean)).toHaveLength(5)
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
