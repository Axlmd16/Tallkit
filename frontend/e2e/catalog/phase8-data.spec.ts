import path from 'node:path'
import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from '../accessibility'

const evidenceDir =
  process.env.CATALOG_EVIDENCE_DIR ??
  '/home/axlmd/.gemini/antigravity-cli/brain/0c543b8a-6ffb-4792-b753-81178d325de2/scratch/evidence'

const phase8EvidenceDir = path.join(evidenceDir, 'phase8-data')

const viewports = [
  { width: 360, height: 700, name: '360' },
  { width: 768, height: 900, name: '768' },
  { width: 1024, height: 900, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
]

test.describe('Fase 8: Datos Tabulares y Listas (C34–C36, C38)', () => {
  const components = [
    { id: 'C34', name: 'data-table', ref: 'F03_4-661_F07_4-3086' },
    { id: 'C35', name: 'data-list', ref: 'F05_4-1636_F13_4-6243' },
    { id: 'C36', name: 'pagination', ref: 'A_PAGINATION' },
    { id: 'C38', name: 'row-actions', ref: 'F05_4-2009_F04_4-1497' },
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
            phase8EvidenceDir,
            `${comp.name}-${vp.name}-${comp.ref}.png`,
          ),
        })

        await expectNoSeriousAccessibilityViolations(page)
      }
    })
  }

  test('verificación de orden y selección controlada en DataTable (C34)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C34')

    const table = page.getByRole('table', { name: 'Elementos sintéticos' })

    // Verificar orden
    const codeHeader = table.getByRole('columnheader', { name: /Código/ })
    await expect(codeHeader).toHaveAttribute('aria-sort', 'ascending')

    const sortButton = codeHeader.getByRole('button', { name: /Código/ })
    await sortButton.click()
    await expect(codeHeader).toHaveAttribute('aria-sort', 'descending')

    // Verificar selección
    const selectAll = table.getByRole('checkbox', {
      name: 'Seleccionar todas las filas',
    })
    await expect(selectAll).toBeVisible()
    await selectAll.click()

    const row1 = table.getByRole('checkbox', {
      name: 'Seleccionar fila ROW-001',
    })
    const row2 = table.getByRole('checkbox', {
      name: 'Seleccionar fila ROW-002',
    })
    await expect(row1).toBeChecked()
    await expect(row2).toBeChecked()
  })

  test('verificación de vista móvil sin scroll horizontal en DataTable y DataList a 360px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 700 })

    // DataTable a 360px muestra la lista de tarjetas
    await page.goto('/visual-catalog.html#isolate=true&id=C34')
    const narrowList = page.getByRole('list', {
      name: 'Elementos sintéticos en pantalla estrecha',
    })
    await expect(narrowList).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      )
    })
    expect(hasHorizontalOverflow).toBe(false)

    // DataList a 360px
    await page.goto('/visual-catalog.html#isolate=true&id=C35')
    const groupedRegion = page.getByRole('region', {
      name: 'Directorio de Clientes',
    })
    await expect(groupedRegion).toBeVisible()

    const dataListOverflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      )
    })
    expect(dataListOverflow).toBe(false)
  })

  test('verificación de paginación y menú en RowActions', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Paginación (C36)
    await page.goto('/visual-catalog.html#isolate=true&id=C36')
    const nextBtn = page.getByRole('button', { name: 'Página siguiente' })
    await expect(nextBtn).toBeEnabled()
    await nextBtn.click()
    await expect(page.getByText('Página 3 de 5 (94 registros)')).toBeVisible()

    // RowActions (C38)
    await page.goto('/visual-catalog.html#isolate=true&id=C38')
    const moreBtn = page.getByRole('button', { name: 'Más' })
    await expect(moreBtn).toBeVisible()
    await moreBtn.click()

    const cancelItem = page.getByRole('menuitem', { name: 'Anular orden' })
    await expect(cancelItem).toBeVisible()
    await expect(cancelItem).toHaveClass(/text-danger/)
  })
})
