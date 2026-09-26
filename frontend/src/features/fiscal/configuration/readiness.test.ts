import { describe, expect, it } from 'vitest'

import {
  destinationHref,
  sectionForCause,
  sectionIndicator,
  summarizeEntityStatus,
} from './readiness'

describe('readiness fiscal', () => {
  it.each([
    ['profile', 'perfil'],
    ['conditions.rimpe.unknown', 'perfil'],
    ['tax_mapping.4.missing', 'impuestos'],
    ['default_point_required', 'puntos'],
    ['payment_forms_missing', 'formas-pago'],
    ['certificate_expired', 'certificado'],
    ['unexpected', null],
  ])('asigna %s a %s', (code, section) => {
    expect(sectionForCause(code)).toBe(section)
  })

  it('agrupa causas, conserva las generales y excluye advertencias', () => {
    const summary = summarizeEntityStatus({
      entity_id: 2,
      state: 'INCOMPLETE',
      causes: [
        {
          code: 'default_point_required',
          kind: 'MISSING',
          message: 'Falta punto.',
        },
        { code: 'unexpected', kind: 'MISSING', message: 'Pendiente general.' },
      ],
      warnings: [
        {
          code: 'certificate_expired',
          kind: 'REVIEW',
          message: 'Certificado vencido.',
        },
      ],
      environment: 'TEST',
      profile_revision: null,
      default_point_id: null,
      default_payment_code: null,
    })

    expect(summary.pending).toBe(2)
    expect(summary.bySection.puntos).toHaveLength(1)
    expect(summary.general).toHaveLength(1)
    expect(summary.firstDestination).toEqual({ entityId: 2, section: 'puntos' })
  })

  it('resume cada subsección y enlaza causas sin subsección a la entidad', () => {
    const summary = summarizeEntityStatus({
      entity_id: 5,
      state: 'NOT_CONFIGURED',
      causes: [{ code: 'otra_causa', kind: 'MISSING', message: 'Otra causa.' }],
      warnings: [
        {
          code: 'certificate_missing',
          kind: 'REVIEW',
          message: 'Sin certificado.',
        },
      ],
      environment: 'TEST',
      profile_revision: null,
      default_point_id: null,
      default_payment_code: null,
    })

    expect(summary.firstDestination).toEqual({ entityId: 5, section: null })
    expect(destinationHref(summary.firstDestination!)).toBe(
      '?tab=facturacion&entidad=5',
    )
    expect(sectionIndicator(summary, 'perfil')).toEqual({
      label: 'Completo',
      tone: 'success',
    })
    expect(sectionIndicator(summary, 'certificado')).toEqual({
      label: 'Revisar',
      tone: 'warning',
    })
    expect(
      sectionIndicator({ ...summary, warnings: [] }, 'certificado').label,
    ).toBe('Opcional')
  })
})
