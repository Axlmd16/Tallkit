export const PAGE_WIDTH_MM = 210
export const PAGE_HEIGHT_MM = 297
export const DEFAULT_LABEL_WIDTH_MM = 63
export const DEFAULT_LABEL_HEIGHT_MM = 38

const MIN_COMPOSITION_WIDTH_MM = 40
const MIN_COMPOSITION_HEIGHT_MM = 25

export class LabelLayoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LabelLayoutError'
  }
}

export interface LabelGrid {
  pageWidthMm: number
  pageHeightMm: number
  labelWidthMm: number
  labelHeightMm: number
  columns: number
  rows: number
  capacity: number
  offsetXmm: number
  offsetYmm: number
}

export interface ProductLabelQuantity {
  product: ProductLabelData
  quantity: number
}

export interface ProductLabelDescriptor {
  product: ProductLabelData
  copyIndex: number
}

export type ProductLabelCell = ProductLabelDescriptor | null

export interface LabelPagesResult {
  pages: ProductLabelCell[][]
  totalLabels: number
  startPosition: number
  didResetStartPosition: boolean
}

export type LabelCompositionValidation =
  | { valid: true }
  | { valid: false; message: string }

function requirePositiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new LabelLayoutError(`${field} debe ser un número positivo.`)
  }
}

export function calculateLabelGrid(
  labelWidthMm: number,
  labelHeightMm: number,
): LabelGrid {
  requirePositiveFinite(labelWidthMm, 'El ancho')
  requirePositiveFinite(labelHeightMm, 'El alto')

  const columns = Math.floor(PAGE_WIDTH_MM / labelWidthMm)
  const rows = Math.floor(PAGE_HEIGHT_MM / labelHeightMm)
  if (columns < 1 || rows < 1) {
    throw new LabelLayoutError(
      'El tamaño debe permitir al menos una etiqueta en A4.',
    )
  }

  return {
    pageWidthMm: PAGE_WIDTH_MM,
    pageHeightMm: PAGE_HEIGHT_MM,
    labelWidthMm,
    labelHeightMm,
    columns,
    rows,
    capacity: columns * rows,
    offsetXmm: (PAGE_WIDTH_MM - columns * labelWidthMm) / 2,
    offsetYmm: (PAGE_HEIGHT_MM - rows * labelHeightMm) / 2,
  }
}

function expandCopies(items: ProductLabelQuantity[]): ProductLabelDescriptor[] {
  return items.flatMap(({ product, quantity }) => {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new LabelLayoutError(
        'La cantidad de copias debe ser un entero no negativo.',
      )
    }
    return Array.from({ length: quantity }, (_, index) => ({
      product,
      copyIndex: index + 1,
    }))
  })
}

export function buildLabelPages(
  items: ProductLabelQuantity[],
  grid: LabelGrid,
  requestedStartPosition: number,
): LabelPagesResult {
  const didResetStartPosition =
    !Number.isInteger(requestedStartPosition) ||
    requestedStartPosition < 1 ||
    requestedStartPosition > grid.capacity
  const startPosition = didResetStartPosition ? 1 : requestedStartPosition
  const labels = expandCopies(items)

  if (labels.length === 0) {
    return {
      pages: [],
      totalLabels: 0,
      startPosition,
      didResetStartPosition,
    }
  }

  const pages: ProductLabelCell[][] = []
  let labelIndex = 0
  let pageIndex = 0

  while (labelIndex < labels.length) {
    const firstAvailableCell = pageIndex === 0 ? startPosition - 1 : 0
    const page = Array<ProductLabelCell>(grid.capacity).fill(null)
    for (
      let cellIndex = firstAvailableCell;
      cellIndex < grid.capacity && labelIndex < labels.length;
      cellIndex += 1
    ) {
      page[cellIndex] = labels[labelIndex++]!
    }
    pages.push(page)
    pageIndex += 1
  }

  return {
    pages,
    totalLabels: labels.length,
    startPosition,
    didResetStartPosition,
  }
}

export function validateLabelComposition(
  widthMm: number,
  heightMm: number,
): LabelCompositionValidation {
  if (
    !Number.isFinite(widthMm) ||
    !Number.isFinite(heightMm) ||
    widthMm < MIN_COMPOSITION_WIDTH_MM ||
    heightMm < MIN_COMPOSITION_HEIGHT_MM
  ) {
    return {
      valid: false,
      message:
        'Aumenta el tamaño para que el nombre, el código y las barras sean legibles.',
    }
  }
  return { valid: true }
}
import type { ProductLabelData } from '@/features/products/types'

export type { ProductLabelData } from '@/features/products/types'
