import path from 'node:path'
import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from '../accessibility'

const evidenceDir =
  process.env.CATALOG_EVIDENCE_DIR ??
  '/home/axlmd/.gemini/antigravity-cli/brain/0c543b8a-6ffb-4792-b753-81178d325de2/scratch/evidence'

const phase3EvidenceDir = path.join(evidenceDir, 'phase3-actions')

const viewports = [
  { width: 360, height: 700, name: '360' },
  { width: 768, height: 900, name: '768' },
  { width: 1024, height: 900, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
]

test.describe('Fase 3: Iconos y Acciones (C01–C04)', () => {
  for (const comp of [
    { id: 'C01', name: 'icon', ref: 'F01_4-645' },
    { id: 'C02', name: 'button', ref: 'F03_4-1017_F08_4-3292' },
    { id: 'C03', name: 'icon-button', ref: 'F08_4-3297' },
    { id: 'C04', name: 'button-group', ref: 'F12_4-6181' },
  ]) {
    test(`captura ${comp.id} (${comp.name}) en 4 anchuras con verificación axe`, async ({
      page,
    }) => {
      for (const vp of viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.goto(`/visual-catalog.html#isolate=true&id=${comp.id}`)

        const isolatedView = page.getByTestId('isolated-view')
        await expect(isolatedView).toBeVisible()

        await page.screenshot({
          animations: 'disabled',
          fullPage: true,
          path: path.join(
            phase3EvidenceDir,
            `${comp.name}-${vp.name}-${comp.ref}.png`,
          ),
        })

        await expectNoSeriousAccessibilityViolations(page)
      }
    })
  }

  test('verificación de accesibilidad por teclado y objetivo táctil de 44x44px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C03')

    const touchButton = page.getByRole('button', {
      name: /eliminar con objetivo táctil/i,
    })
    await expect(touchButton).toBeVisible()

    const box = await touchButton.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }

    // Navegación por teclado y foco
    await touchButton.focus()
    await expect(touchButton).toBeFocused()
  })
})
