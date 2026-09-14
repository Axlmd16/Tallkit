import { describe, expect, it } from 'vitest'

import {
  COMPONENT_REGISTRY,
  FRAME_REGISTRY,
  findComponentById,
  getComponentsByCategory,
  resetCatalogState,
  searchComponents,
} from './registry'
import { renderComponentPreview } from './previews'

describe('Registry - Catálogo C01-C66 y F01-F22', () => {
  it('contiene exactamente 66 componentes en la matriz C01 a C66', () => {
    expect(COMPONENT_REGISTRY).toHaveLength(66)
    const ids = COMPONENT_REGISTRY.map((c) => c.id)
    for (let i = 1; i <= 66; i++) {
      const expectedId = `C${String(i).padStart(2, '0')}`
      expect(ids).toContain(expectedId)
    }
  })

  it('contiene los 22 frames de referencia F01 a F22', () => {
    expect(FRAME_REGISTRY).toHaveLength(22)
    const frameIds = FRAME_REGISTRY.map((f) => f.ref)
    for (let i = 1; i <= 22; i++) {
      const expectedRef = `F${String(i).padStart(2, '0')}`
      expect(frameIds).toContain(expectedRef)
    }
  })

  it('permite buscar componentes por id, nombre o categoría', () => {
    const byId = searchComponents('C02')
    expect(byId).toHaveLength(1)
    expect(byId[0]?.name).toBe('Button')

    const byName = searchComponents('table')
    expect(byName.some((c) => c.id === 'C34')).toBe(true)

    const byCat = searchComponents('charts')
    expect(byCat.length).toBeGreaterThanOrEqual(4)
  })

  it('encuentra componente por id exacto con findComponentById', () => {
    const btn = findComponentById('C02')
    expect(btn).toBeDefined()
    expect(btn?.name).toBe('Button')
    expect(btn?.priority).toBe('P1')
    expect(findComponentById('UNKNOWN')).toBeUndefined()
  })

  it('agrupa y filtra correctamente por categoría', () => {
    const forms = getComponentsByCategory('forms')
    expect(forms.length).toBeGreaterThanOrEqual(8)
    expect(forms.every((c) => c.category === 'forms')).toBe(true)
  })

  it('proporciona un estado inicial limpio y reset determinista', () => {
    const state = resetCatalogState()
    expect(state.selectedId).toBeNull()
    expect(state.searchQuery).toBe('')
    expect(state.selectedCategory).toBeNull()
    expect(state.isIsolated).toBe(false)
  })

  it('mantiene trazabilidad verificable y un preview para cada componente', () => {
    const frameRefs = new Set(FRAME_REGISTRY.map((frame) => frame.ref))
    const tokenPattern = /^K[1-8]$/

    for (const component of COMPONENT_REGISTRY) {
      const evidenceRefs = (component as ComponentEntryWithEvidence)
        .evidenceRefs

      expect(component.variants.length, component.id).toBeGreaterThan(0)
      expect(component.tokens.length, component.id).toBeGreaterThan(0)
      expect(
        component.tokens.every((token) => tokenPattern.test(token)),
        component.id,
      ).toBe(true)
      expect(
        component.frameRef === 'A' || frameRefs.has(component.frameRef),
        component.id,
      ).toBe(true)
      expect(evidenceRefs?.length, component.id).toBeGreaterThan(0)
      expect(
        evidenceRefs?.every((ref) =>
          /^e2e\/catalog\/phase\d+[\w-]*\.spec\.ts$/.test(ref),
        ),
        component.id,
      ).toBe(true)
      expect(renderComponentPreview(component.id), component.id).not.toBeNull()
    }
  })

  it('no presenta evidencia exacta como verificada sin referencia, captura y diff comparables', () => {
    for (const component of COMPONENT_REGISTRY) {
      const visualEvidence = (
        component as typeof component & {
          visualEvidence?: { actual?: string; diff?: string; figma?: string }
        }
      ).visualEvidence

      if (component.kind === 'E' && component.evidenceStatus === 'verified') {
        expect(visualEvidence?.figma, component.id).toBeTruthy()
        expect(visualEvidence?.actual, component.id).toBeTruthy()
        expect(visualEvidence?.diff, component.id).toBeTruthy()
      }
    }

    expect(findComponentById('C22')?.evidenceStatus).toBe('pending')
  })

  it('no preaprueba adaptaciones antes de revisar su evidencia', () => {
    const adaptation = COMPONENT_REGISTRY.find(
      (component) => component.kind === 'A' && !component.visualEvidence,
    )

    expect(adaptation).toBeDefined()
    expect(adaptation?.evidenceStatus).toBe('pending')
  })
})

interface ComponentEntryWithEvidence {
  evidenceRefs?: string[]
}
