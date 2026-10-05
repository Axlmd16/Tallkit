import { describe, expect, it, vi } from 'vitest'

import type { ApiClient } from '@/shared/api/client'

import { createFiscalApi } from './api'

function fakeClient() {
  const request = vi.fn().mockResolvedValue({})
  const requestBlob = vi.fn().mockResolvedValue(new Blob())
  return {
    client: { request, requestBlob } as unknown as ApiClient,
    request,
    requestBlob,
  }
}

describe('fiscalApi', () => {
  it('creates and prepares with an idempotency header owned by the fiscal contract', async () => {
    const { client, request } = fakeClient()
    const api = createFiscalApi(client)
    await api.createPreparation('COMMERCIAL', 8, 'attempt-1')
    expect(request).toHaveBeenLastCalledWith('/fiscal/preparations/', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'attempt-1' },
      body: { source_kind: 'COMMERCIAL', source_id: 8 },
    })
    await api.prepare('prep-1', 'review-token', 'attempt-2')
    expect(request).toHaveBeenLastCalledWith(
      '/fiscal/preparations/prep-1/prepare/',
      {
        method: 'POST',
        headers: { 'Idempotency-Key': 'attempt-2' },
        body: { review_token: 'review-token' },
      },
    )
  })

  it('uploads bounded XML as FormData and downloads exact private bytes', async () => {
    const { client, request, requestBlob } = fakeClient()
    const api = createFiscalApi(client)
    const xml = new File(['<factura/>'], 'factura.xml', {
      type: 'application/xml',
    })
    await api.uploadArchive(2, 'Facturador SRI', xml)
    const body = request.mock.calls[0]?.[1].body as FormData
    expect(body.get('fiscal_entity_id')).toBe('2')
    expect(body.get('source_label')).toBe('Facturador SRI')
    expect(body.get('xml')).toBe(xml)
    await api.downloadArchive('doc-1')
    expect(requestBlob).toHaveBeenCalledWith('/fiscal/archive/doc-1/download/')
  })

  it('keeps every correction amount as a decimal string', async () => {
    const { client, request } = fakeClient()
    await createFiscalApi(client).createCorrection(
      {
        original_dossier_id: 'doc-1',
        action: 'CREDIT_NOTE',
        reason: 'Corrección parcial',
        reference_date: '2026-09-26',
        facts: {
          consumer_final_transmitted: false,
          supports_tax_refund: false,
          negotiable_traded: false,
          external_history_complete: true,
          holidays_complete: true,
          holidays: [],
          calendar_source: 'Calendario',
          calendar_version: '2026',
        },
        lines: [
          {
            position: 1,
            quantity: '1.25',
            base_amount: '10.00',
            tax_amount: '1.50',
            total_amount: '11.50',
          },
        ],
      },
      'attempt-3',
    )
    expect(request.mock.calls[0]?.[1].body.lines[0]).toEqual(
      expect.objectContaining({
        quantity: '1.25',
        base_amount: '10.00',
        tax_amount: '1.50',
        total_amount: '11.50',
      }),
    )
  })

  it('saves profile metadata with PUT and never accepts signing material in its type', async () => {
    const { client, request } = fakeClient()
    await createFiscalApi(client).saveElectronicProfile(
      3,
      { expected_revision: 0, conditions: {}, certificate: null },
      'profile-1',
    )
    expect(request).toHaveBeenCalledWith(
      '/fiscal/configuration/entities/3/electronic-profile/',
      {
        method: 'PUT',
        headers: { 'Idempotency-Key': 'profile-1' },
        body: { expected_revision: 0, conditions: {}, certificate: null },
      },
    )
  })

  it('exposes the remaining owned preparation, archive and correction routes', async () => {
    const { client, request, requestBlob } = fakeClient()
    const api = createFiscalApi(client)
    await api.updateDraft('p1', {
      expected_version: 1,
      receiver: {
        identification_type: '04',
        identification: '0999999999001',
        legal_name: 'Cliente',
      },
      payments: { forms: [{ payment_code: '01', amount: '10.00' }] },
    })
    await api.getActivePreparation('COMMERCIAL', 7)
    await api.review('p1')
    await api.cancelPreparation('p1', 2, 'Reemplazo')
    await api.assignTestIdentity('p1')
    await api.listArchive(4)
    await api.listArchive(undefined, {
      environment: '2',
      documentType: '04',
      issuedFrom: '2026-09-01',
      issuedTo: '2026-09-30',
      page: 2,
    })
    await api.exportArchive(['d1', 'd2'])
    await api.linkArchive('d1', {
      source_kind: 'ARTISAN',
      source_id: 9,
      reason: 'Conciliación',
    })
    await api.prepareCorrection('c1', 1)
    await api.cancelCorrection('c1', 2, 'Cancelación local')

    expect(request.mock.calls.map((call) => call[0])).toEqual([
      '/fiscal/preparations/p1/',
      '/fiscal/preparations/?source_kind=COMMERCIAL&source_id=7',
      '/fiscal/preparations/p1/review/',
      '/fiscal/preparations/p1/cancel/',
      '/fiscal/preparations/p1/test-identity/',
      '/fiscal/archive/?fiscal_entity_id=4',
      '/fiscal/archive/?environment=2&document_type=04&issued_from=2026-09-01&issued_to=2026-09-30&page=2',
      '/fiscal/archive/d1/link/',
      '/fiscal/corrections/c1/prepare/',
      '/fiscal/corrections/c1/cancel/',
    ])
    expect(requestBlob).toHaveBeenCalledWith('/fiscal/archive/export/', {
      method: 'POST',
      body: { dossier_ids: ['d1', 'd2'] },
    })
  })

  it('exposes owned establishment, point, mapping and numbering commands', async () => {
    const { client, request } = fakeClient()
    const api = createFiscalApi(client)
    await api.getElectronicProfile(2)
    await api.listEstablishments(2)
    await api.createEstablishment(2, '001', 'Matriz')
    await api.setEstablishmentActive(5, 1, false)
    await api.createPoint(5, '002')
    await api.setPointActive(8, 1, true)
    await api.createTaxMapping({
      definition_id: 3,
      catalog_entry_id: 11,
      starts_on: '2026-01-01',
      source: 'Ficha SRI',
    })
    await api.scheduleTaxMappingSuccessor(3, {
      catalog_entry_id: 11,
      starts_on: '2027-01-01',
      source: 'Cambio de régimen',
    })
    await api.recordNumberingAntecedent({
      entity_id: 2,
      document_type: '01',
      establishment_code: '001',
      emission_point_code: '002',
      environment: '1',
      last_declared_number: 14,
      declared_on: '2026-09-26',
      source: 'Facturador SRI',
    })

    expect(request.mock.calls.map((call) => call[0])).toEqual([
      '/fiscal/configuration/entities/2/electronic-profile/',
      '/fiscal/configuration/entities/2/establishments/',
      '/fiscal/configuration/entities/2/establishments/',
      '/fiscal/configuration/establishments/5/',
      '/fiscal/configuration/establishments/5/points/',
      '/fiscal/configuration/points/8/',
      '/fiscal/configuration/tax-mappings/',
      '/fiscal/configuration/tax-mappings/3/successor/',
      '/fiscal/configuration/numbering-antecedents/',
    ])
  })

  it('reads centralized configuration and writes defaults and payment forms with attempts', async () => {
    const { client, request } = fakeClient()
    const api = createFiscalApi(client)
    await api.getElectronicStatus(2)
    await api.getPreparationDefaults(2)
    await api.getCatalog('PAYMENT_FORM')
    await api.getCatalog('TAX_RATE', true)
    await api.getTaxMappings(2)
    await api.getPaymentForms(2)
    await api.savePreparationDefaults(
      2,
      { expected_version: 0, default_point_id: 5 },
      'defaults-1',
    )
    await api.setPaymentForm(
      2,
      '20',
      { enabled: false, expected_version: 0 },
      'form-1',
    )

    expect(request.mock.calls.map((call) => call[0])).toEqual([
      '/fiscal/configuration/entities/2/electronic-status/',
      '/fiscal/configuration/entities/2/preparation-defaults/',
      '/fiscal/configuration/catalogs/payment_form/',
      '/fiscal/configuration/catalogs/tax_rate/?selectable=true',
      '/fiscal/configuration/entities/2/tax-mappings/',
      '/fiscal/configuration/entities/2/payment-forms/',
      '/fiscal/configuration/entities/2/preparation-defaults/',
      '/fiscal/configuration/entities/2/payment-forms/20/',
    ])
    expect(request.mock.calls[6]![1]).toEqual({
      method: 'PUT',
      headers: { 'Idempotency-Key': 'defaults-1' },
      body: { expected_version: 0, default_point_id: 5 },
    })
    expect(request.mock.calls[7]![1]).toEqual({
      method: 'PUT',
      headers: { 'Idempotency-Key': 'form-1' },
      body: { enabled: false, expected_version: 0 },
    })
  })
})
