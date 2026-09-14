import path from 'node:path'
import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from '../accessibility'

const evidenceDir = process.env.CATALOG_EVIDENCE_DIR
if (!evidenceDir) {
  throw new Error(
    'CATALOG_EVIDENCE_DIR es obligatorio y debe estar fuera del repositorio',
  )
}

const phase13EvidenceDir = path.join(evidenceDir, 'phase13-timeline-board')
const viewports = [
  { width: 360, height: 700, name: '360' },
  { width: 768, height: 900, name: '768' },
  { width: 1024, height: 900, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
]

test.describe('Fase 13: cronograma y tablero (C60–C62)', () => {
  for (const component of [
    { id: 'C60', name: 'timeline', ref: 'F15_4-3638' },
    { id: 'C61', name: 'board', ref: 'F06_4-2639' },
    { id: 'C62', name: 'board-card', ref: 'F06_4-2641' },
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
            phase13EvidenceDir,
            `${component.name}-${viewport.name}-${component.ref}.png`,
          ),
        })
      }
    })
  }

  test('Timeline mantiene barras acotadas, lectura alternativa y selección por teclado', async ({
    page,
  }) => {
    await page.goto('/visual-catalog.html#isolate=true&id=C60')
    const rowC = page.getByRole('button', { name: /Elemento C: 70 a 110/i })
    const box = await rowC.boundingBox()
    const regionBox = await page
      .getByRole('region', {
        name: /cronograma sintético: región desplazable/i,
      })
      .boundingBox()
    expect(box).not.toBeNull()
    expect(regionBox).not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(
      regionBox!.x + regionBox!.width + 1,
    )

    await rowC.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('timeline-selection')).toHaveText('row-c')
    await expect(page.getByTestId('timeline-text-alternative')).toContainText(
      'Elemento C: 70 a 110',
    )
  })

  test('Board limita el scroll a su región y conserva selección y acciones visibles', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 700 })
    await page.goto('/visual-catalog.html#isolate=true&id=C61')

    const documentOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(documentOverflow).toBeLessThanOrEqual(5)

    const boardRegion = page.getByRole('region', {
      name: /tablero sintético: columnas desplazables/i,
    })
    expect(
      await boardRegion.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true)

    const cardC = page.getByRole('button', { name: 'Elemento C' })
    await cardC.focus()
    await page.keyboard.press(' ')
    await expect(page.getByTestId('board-selection')).toHaveText('card-c')

    const action = page.getByRole('button', { name: 'Acción B' })
    await expect(action).toBeVisible()
    await action.click()
    await expect(page.getByTestId('board-action-message')).toHaveText(
      'Acción B activada',
    )
    await expect(page.getByTestId('board-selection')).toHaveText('card-c')
  })
})
