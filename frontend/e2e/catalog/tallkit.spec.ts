import path from 'node:path'
import { expect, test } from '@playwright/test'

import { CATALOG } from '../../src/dev/visual-catalog/registry'
import { expectNoSeriousAccessibilityViolations } from '../accessibility'

const evidenceDir = process.env.CATALOG_EVIDENCE_DIR ?? ''
const WIDTHS = [360, 768, 1024, 1280, 1440]

test.describe('Catálogo Tallkit en los cinco anchos', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  for (const entry of CATALOG) {
    test(`${entry.id} ${entry.name}: sin desbordes ni violaciones graves`, async ({
      page,
    }) => {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`/visual-catalog.html#isolate=true&id=${entry.id}`)
        await expect(page.getByTestId('isolated-view')).toContainText(
          entry.name,
        )
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        )
        expect(
          overflow,
          `desborde horizontal a ${width} px`,
        ).toBeLessThanOrEqual(0)
        await page.screenshot({
          fullPage: true,
          path: path.join(evidenceDir, 'actual', `${entry.id}-${width}.png`),
        })
      }
      await expectNoSeriousAccessibilityViolations(page)
    })
  }

  test('los toasts se apilan hasta tres y no roban el foco', async ({
    page,
  }) => {
    await page.goto('/visual-catalog.html#isolate=true&id=TK-16')
    const trigger = page.getByRole('button', { name: 'Crear producto' })
    for (let i = 0; i < 4; i += 1) await trigger.click()
    await expect(trigger).toBeFocused()
    await expect(page.getByText('Producto ACE-1030 creado.')).toHaveCount(3)
  })

  test('el modal corto advierte antes de descartar cambios', async ({
    page,
  }) => {
    await page.goto('/visual-catalog.html#isolate=true&id=TK-13')
    await page.getByRole('button', { name: 'Nueva marca' }).click()
    await page.getByLabel('Nombre de la marca').fill('Great Wall')
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('button', { name: 'Seguir editando' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Seguir editando' }).click()
    await expect(page.getByLabel('Nombre de la marca')).toHaveValue(
      'Great Wall',
    )
  })
})
