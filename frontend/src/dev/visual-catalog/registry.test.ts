import { describe, expect, it } from 'vitest'

import {
  CATALOG,
  FAMILY_LABELS,
  filterCatalog,
  findEntry,
  type CatalogFamily,
} from './registry'

describe('registro del catálogo Tallkit', () => {
  it('cada entrada tiene identificador único y procedencia Tallkit', () => {
    const ids = CATALOG.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const entry of CATALOG) {
      expect(entry.id).toMatch(/^TK-\d{2}$/)
      if (entry.source.kind === 'tablero') {
        expect(entry.source.board.length).toBeGreaterThan(0)
      } else {
        expect(entry.source.reason.length).toBeGreaterThan(0)
      }
      expect(entry.tokens.length).toBeGreaterThan(0)
      expect(entry.variants.length).toBeGreaterThan(0)
    }
  })

  it('cubre todas las familias de Tallkit', () => {
    const families = new Set(CATALOG.map((entry) => entry.family))
    for (const family of Object.keys(FAMILY_LABELS) as CatalogFamily[]) {
      expect(families.has(family), family).toBe(true)
    }
  })

  it('no conserva nodos de Figma ni familias retiradas', () => {
    const text = JSON.stringify(CATALOG)
    expect(text).not.toMatch(/\d+:\d{2,}/)
    expect(text).not.toMatch(/figma|calendar|chart|board-list|conversation/i)
  })

  it('filtra por texto y por familia', () => {
    expect(filterCatalog('combobox', null).map((e) => e.id)).toContain('TK-06')
    expect(
      filterCatalog('', 'notificaciones').every(
        (e) => e.family === 'notificaciones',
      ),
    ).toBe(true)
    expect(findEntry('TK-16')?.name).toBe('Notificación temporal')
    expect(findEntry('C01')).toBeUndefined()
  })
})
