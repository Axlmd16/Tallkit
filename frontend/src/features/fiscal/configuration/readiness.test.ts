import { describe, expect, it } from 'vitest'

import {
  destinationHref,
  sectionForCause,
  sectionIndicator,
  summarizeEntityStatus,
  warningSection,
} from './readiness'

describe('readiness fiscal', () => {
  it.each([
    ['profile', 'perfil'],
    ['conditions.tax_regime.unknown', 'perfil'],
    ['conditions.artisan_qualification.expired', 'perfil'],
    ['conditions.tax_regime.unsupported', 'perfil'],
    ['profile.legacy_format', 'perfil'],
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

  it.each([
    ['certificate_missing', 'certificado'],
    ['certificate_expired', 'certificado'],
    ['artisan_qualification_expiring', 'perfil'],
    ['aviso_nuevo', null],
  ])('asigna la advertencia %s a %s', (code, section) => {
    expect(warningSection(code)).toBe(section)
  })

  it('marca el perfil a revisar por el aviso de calificación sin tocar el certificado', () => {
    const summary = summarizeEntityStatus({
      entity_id: 2,
      state: 'READY',
      causes: [],
      warnings: [
        {
          code: 'artisan_qualification_expiring',
          kind: 'REVIEW',
          message:
            'Calificación artesanal: vence el 2026-11-10 (faltan 45 días).',
        },
      ],
      environment: 'TEST',
      profile_revision: 3,
      default_point_id: 1,
      default_payment_code: '01',
    })

    expect(sectionIndicator(summary, 'perfil')).toEqual({
      label: 'Revisar',
      tone: 'warning',
    })
    expect(sectionIndicator(summary, 'certificado')).toEqual({
      label: 'Opcional',
      tone: 'neutral',
    })
    expect(summary.pending).toBe(0)
  })
})
