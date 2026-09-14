import path from 'node:path'
import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from '../accessibility'

const evidenceDir = process.env.CATALOG_EVIDENCE_DIR
if (!evidenceDir) {
  throw new Error(
    'CATALOG_EVIDENCE_DIR es obligatorio y debe estar fuera del repositorio',
  )
}

const phase14EvidenceDir = path.join(evidenceDir, 'phase14-conversation')
const viewports = [
  { width: 360, height: 700, name: '360' },
  { width: 768, height: 900, name: '768' },
  { width: 1024, height: 900, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
]

test.describe('Fase 14: conversación visual (C63–C65)', () => {
  for (const component of [
    { id: 'C63', name: 'conversation-list', ref: 'F22_4-7527' },
    { id: 'C64', name: 'message-bubble', ref: 'F22_4-7460_4-7474' },
    { id: 'C65', name: 'message-composer', ref: 'F22_4-7442' },
  ]) {
    test(`captura ${component.id} en cuatro anchuras con axe`, async ({
      page,
    }) => {
      for (const viewport of viewports) {
        await page.setViewportSize(viewport)
        await page.goto(`/visual-catalog.html#isolate=true&id=${component.id}`)
        await expect(page.getByTestId('isolated-view')).toBeVisible()
        await expectNoSeriousAccessibilityViolations(page)
        await page.screenshot({
          animations: 'disabled',
          fullPage: true,
          path: path.join(
            phase14EvidenceDir,
            `${component.name}-${viewport.name}-${component.ref}.png`,
          ),
        })
      }
    })
  }

  test('lista y burbujas conservan agrupación, selección por teclado y texto largo', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 700 })
    await page.goto('/visual-catalog.html#isolate=true&id=C63')

    await expect(page.getByRole('heading', { name: 'Recientes' })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Anteriores' }),
    ).toBeVisible()
    const threadB = page.getByRole('button', { name: /Hilo B/i })
    await threadB.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('conversation-selection')).toHaveText(
      'thread-b',
    )

    await page
      .getByRole('searchbox', { name: 'Buscar conversaciones' })
      .fill('Hilo C')
    await expect(page.getByRole('button', { name: /Hilo C/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Hilo A/i })).toHaveCount(0)

    await page.goto('/visual-catalog.html#isolate=true&id=C64')
    await expect(page.getByText(/longitud suficiente/i)).toBeVisible()
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(5)
  })

  test('compositor solo emite callbacks locales, bloquea pending y no usa red ni medios', async ({
    page,
  }) => {
    const externalOrApiRequests: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (
        url.pathname.startsWith('/api/') ||
        !['127.0.0.1', 'localhost'].includes(url.hostname)
      ) {
        externalOrApiRequests.push(request.url())
      }
    })
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: () => {
            ;(
              window as typeof window & { __mediaAccesses?: number }
            ).__mediaAccesses =
              ((window as typeof window & { __mediaAccesses?: number })
                .__mediaAccesses ?? 0) + 1
            return Promise.reject(new Error('Acceso a medios no permitido'))
          },
        },
      })
    })

    await page.goto('/visual-catalog.html#isolate=true&id=C65')
    const textbox = page.getByRole('textbox', { name: 'Mensaje neutral' })
    await textbox.fill('  Elemento A  ')
    await page.getByRole('button', { name: 'Enviar mensaje' }).click()
    await expect(page.getByTestId('composer-result')).toHaveText('Elemento A')

    await textbox.fill('Elemento B')
    await page.getByRole('button', { name: 'Activar pending' }).click()
    await expect(
      page.getByRole('button', { name: 'Enviando mensaje' }),
    ).toBeDisabled()
    await expect(page.getByTestId('composer-result')).toHaveText('Elemento A')

    expect(externalOrApiRequests).toEqual([])
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { __mediaAccesses?: number })
            .__mediaAccesses ?? 0,
      ),
    ).toBe(0)
    await expect(page.locator('input[type="file"]')).toHaveCount(0)
  })
})
