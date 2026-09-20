import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const API = '/api/v1'

export async function csrf(request: APIRequestContext): Promise<string> {
  await request.get(`${API}/auth/csrf/`)
  const cookies = await request.storageState()
  return cookies.cookies.find((c) => c.name === 'csrftoken')?.value ?? ''
}

export async function send(
  request: APIRequestContext,
  method: 'post' | 'patch',
  path: string,
  data: Record<string, unknown>,
) {
  return request[method](`${API}${path}`, {
    data,
    headers: { 'X-CSRFToken': await csrf(request) },
  })
}

/** Deja una configuración fiscal mínima con un impuesto por ámbito (idempotente). */
export async function seedFiscalConfiguration(page: Page) {
  const request = page.request
  const status = await request.get(`${API}/workshop-configuration/status/`)
  const initialized =
    status.ok() && (await status.json()).is_initialized === true
  if (!initialized) {
    const key = `e2e-init-${Date.now()}`
    const response = await send(
      request,
      'post',
      '/workshop-configuration/initialize/',
      {
        commercial_ruc: '1790000000001',
        commercial_legal_name: 'Comercial E2E',
        artisanal_ruc: '1790000000002',
        artisanal_legal_name: 'Artesanal E2E',
        warehouse_name: 'Bodega E2E',
        idempotency_key: key,
      },
    )
    expect(response.ok(), await response.text()).toBeTruthy()
  }
  const entities: Array<{ id: number; entity_type: string }> = await (
    await request.get(`${API}/workshop-configuration/entities/`)
  ).json()
  const existing: Array<{
    fiscal_entity_id?: number
    code: string
  }> = await (await request.get(`${API}/workshop-configuration/taxes/`)).json()
  for (const entity of entities) {
    if (
      existing.some(
        (tax) => tax.code === 'IVA15' && tax.fiscal_entity_id === entity.id,
      )
    )
      continue
    const created = await send(
      request,
      'post',
      '/workshop-configuration/taxes/',
      {
        entity_id: entity.id,
        code: 'IVA15',
        name: 'IVA 15%',
      },
    )
    if (!created.ok()) continue
    const definition = await created.json()
    await send(
      request,
      'post',
      `/workshop-configuration/taxes/${definition.id}/periods/`,
      {
        rate: '15',
        starts_on: '2026-01-01',
      },
    )
  }
  // Las llamadas directas rotan la cookie CSRF: recarga para que la aplicación la relea.
  await page.reload()
}
