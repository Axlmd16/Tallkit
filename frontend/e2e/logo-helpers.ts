import { expect, type Page } from '@playwright/test'

import { API, csrf } from './catalog-helpers'

/** PNG válido de 1 × 1 px generado para las pruebas; no es un logotipo real. */
export const LOGO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

/** SVG con código incrustado: el servidor debe rechazarlo. */
export const LOGO_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
)

type EntityType = 'COMERCIAL' | 'ARTESANAL'

async function entity(page: Page, type: EntityType) {
  const entities: Array<{
    id: number
    entity_type: string
    legal_name: string
  }> = await (
    await page.request.get(`${API}/workshop-configuration/entities/`)
  ).json()
  return entities.find((item) => item.entity_type === type)!
}

/** Sube por la API el logotipo de una entidad (requiere sesión de Administrador). */
export async function uploadEntityLogo(page: Page, type: EntityType) {
  const target = await entity(page, type)
  const response = await page.request.post(
    `${API}/workshop-configuration/entities/${target.id}/logo/`,
    {
      headers: { 'X-CSRFToken': await csrf(page.request) },
      multipart: {
        file: { name: 'logo.png', mimeType: 'image/png', buffer: LOGO_PNG },
        idempotency_key: `e2e-logo-${type}-${Date.now()}`,
      },
    },
  )
  expect(response.ok(), await response.text()).toBeTruthy()
  return target
}

/** Quita por la API el logotipo de una entidad; es inocuo si no tiene. */
export async function removeEntityLogo(page: Page, type: EntityType) {
  const target = await entity(page, type)
  const response = await page.request.post(
    `${API}/workshop-configuration/entities/${target.id}/logo/remove/`,
    {
      headers: { 'X-CSRFToken': await csrf(page.request) },
      data: { idempotency_key: `e2e-logo-rm-${type}-${Date.now()}` },
    },
  )
  expect(response.ok(), await response.text()).toBeTruthy()
  return target
}
