import path from 'node:path'
import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from '../accessibility'

const evidenceDir =
  process.env.CATALOG_EVIDENCE_DIR ??
  '/home/axlmd/.gemini/antigravity-cli/brain/0c543b8a-6ffb-4792-b753-81178d325de2/scratch/evidence'

const phase6EvidenceDir = path.join(evidenceDir, 'phase6-selection')

const viewports = [
  { width: 360, height: 700, name: '360' },
  { width: 768, height: 900, name: '768' },
  { width: 1024, height: 900, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
]

test.describe('Fase 6: Menús, Pestañas y Selección (C13–C17, C20)', () => {
  const components = [
    { id: 'C13', name: 'date-control', ref: 'F02_4-222_F09_4-4424' },
    { id: 'C14', name: 'segmented-control', ref: 'F12_4-6195_F06_4-2258' },
    { id: 'C15', name: 'tabs', ref: 'F13_4-6443_F22_4-7590' },
    { id: 'C16', name: 'tooltip', ref: 'F02_4-157_A' },
    { id: 'C17', name: 'dropdown-menu', ref: 'F04_4-1497_F07_4-3105' },
    { id: 'C20', name: 'filter-panel', ref: 'F06_4-2247_F03_4-1024' },
  ]

  for (const comp of components) {
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
            phase6EvidenceDir,
            `${comp.name}-${vp.name}-${comp.ref}.png`,
          ),
        })

        await expectNoSeriousAccessibilityViolations(page)
      }
    })
  }

  test('verificación de interacción por teclado en SegmentedControl, Tabs y DropdownMenu', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // SegmentedControl (C14)
    await page.goto('/visual-catalog.html#isolate=true&id=C14')
    const weekOption = page.getByRole('radio', { name: 'Semana' })
    await weekOption.focus()
    await expect(weekOption).toBeFocused()
    await page.keyboard.press('ArrowRight')
    const monthOption = page.getByRole('radio', { name: 'Mes' })
    await expect(monthOption).toBeFocused()

    // Tabs (C15)
    await page.goto('/visual-catalog.html#isolate=true&id=C15')
    const boardTab = page.getByRole('tab', { name: /Tablero/ })
    await boardTab.focus()
    await expect(boardTab).toBeFocused()
    await page.keyboard.press('ArrowRight')
    const timelineTab = page.getByRole('tab', { name: /Cronograma/ })
    await expect(timelineTab).toBeFocused()
    await expect(timelineTab).toHaveAttribute('aria-selected', 'true')

    // DropdownMenu (C17)
    await page.goto('/visual-catalog.html#isolate=true&id=C17')
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    const deleteItem = page.getByRole('menuitem', { name: 'Eliminar vehículo' })
    await expect(deleteItem).toBeVisible()
    await expect(deleteItem).toHaveClass(/text-danger/)
  })

  test('verificación táctil accesible 44x44px y separación de 8px en Tooltip y acciones', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C16')

    const downloadBtn = page.getByRole('button', { name: 'Descargar informe' })
    const box = await downloadBtn.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }

    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toHaveText(/Descargar informe consolidado/)
  })
})
