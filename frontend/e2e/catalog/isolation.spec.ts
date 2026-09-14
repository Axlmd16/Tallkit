import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from '../accessibility'

test.describe('Visual Catalog - Aislamiento e Independencia', () => {
  test('carga la entrada /visual-catalog.html sin solicitudes a la API y sin Django', async ({
    page,
  }) => {
    const apiRequests: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('/api/')) {
        apiRequests.push(url)
      }
    })

    await page.goto('/visual-catalog.html')

    const catalogRoot = page.locator('[data-visual-catalog]')
    await expect(catalogRoot).toBeVisible()

    const heading = page.getByRole('heading', {
      name: /catálogo visual reutilizable/i,
    })
    await expect(heading).toBeVisible()

    // Comprobar que no se realizan llamadas de negocio o API
    expect(apiRequests).toEqual([])

    // Comprobar que no hay violaciones serias o críticas de accesibilidad
    await expectNoSeriousAccessibilityViolations(page)
  })

  test('permite navegación interna y vista aislada sin dependencias externas', async ({
    page,
  }) => {
    await page.goto('/visual-catalog.html#isolate=true&id=C02')

    const isolatedView = page.getByTestId('isolated-view')
    await expect(isolatedView).toBeVisible()
    await expect(page.getByText('C02 — Button')).toBeVisible()

    // El marco general del catálogo no se muestra en modo de captura aislada
    await expect(
      page.getByRole('heading', { name: /catálogo visual reutilizable/i }),
    ).not.toBeVisible()

    await expectNoSeriousAccessibilityViolations(page)
  })

  test('funciona sin red externa bloqueando cualquier origen remoto', async ({
    page,
    context,
  }) => {
    await context.route('**/*', (route) => {
      const url = route.request().url()
      if (
        url.startsWith('http://127.0.0.1') ||
        url.startsWith('http://localhost')
      ) {
        route.continue()
      } else {
        route.abort()
      }
    })

    await page.goto('/visual-catalog.html')
    await expect(page.locator('[data-visual-catalog]')).toBeVisible()
  })

  test('el build productivo no incluye la entrada visual-catalog.html', () => {
    const distDir = path.resolve(process.cwd(), 'dist')
    if (fs.existsSync(distDir)) {
      const files = fs.readdirSync(distDir)
      expect(files).not.toContain('visual-catalog.html')
      expect(files.some((f) => f.includes('visual-catalog'))).toBe(false)
    }
  })
})
