import path from 'node:path'
import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from '../accessibility'

const evidenceDir =
  process.env.CATALOG_EVIDENCE_DIR ??
  '/home/axlmd/.gemini/antigravity-cli/brain/0c543b8a-6ffb-4792-b753-81178d325de2/scratch/evidence'

const phase5EvidenceDir = path.join(evidenceDir, 'phase5-primitives')

const viewports = [
  { width: 360, height: 700, name: '360' },
  { width: 768, height: 900, name: '768' },
  { width: 1024, height: 900, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
]

test.describe('Fase 5: Feedback, Avatar y Superficies Primitivas (C18, C19, C21, C24, C26, C37, C44–C48)', () => {
  const components = [
    { id: 'C18', name: 'page-header', ref: 'F08_4-3259' },
    { id: 'C19', name: 'toolbar', ref: 'F03_4-1017' },
    { id: 'C21', name: 'surface', ref: 'F02_4-93' },
    { id: 'C24', name: 'avatar', ref: 'F03_4-966' },
    { id: 'C26', name: 'divider', ref: 'F17_4-9255' },
    { id: 'C37', name: 'status-badge', ref: 'F03_4-976' },
    { id: 'C44', name: 'loading-state', ref: 'A_CVR-09' },
    { id: 'C45', name: 'empty-state', ref: 'A_CVR-09' },
    { id: 'C46', name: 'error-state', ref: 'A_RNF-USA-004' },
    { id: 'C47', name: 'success-state', ref: 'F20_4-9341' },
    { id: 'C48', name: 'no-results-state', ref: 'A_CVR-09' },
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
            phase5EvidenceDir,
            `${comp.name}-${vp.name}-${comp.ref}.png`,
          ),
        })

        await expectNoSeriousAccessibilityViolations(page)
      }
    })
  }

  test('verificación de foco y teclado en Toolbar, ErrorState y NoResultsState', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Toolbar (C19)
    await page.goto('/visual-catalog.html#isolate=true&id=C19')
    const filterBtn = page.getByRole('button', { name: 'Filtrar' })
    await filterBtn.focus()
    await expect(filterBtn).toBeFocused()

    // ErrorState (C46)
    await page.goto('/visual-catalog.html#isolate=true&id=C46')
    const retryBtn = page.getByRole('button', { name: 'Reintentar' })
    await retryBtn.focus()
    await expect(retryBtn).toBeFocused()

    // NoResultsState (C48)
    await page.goto('/visual-catalog.html#isolate=true&id=C48')
    const clearBtn = page.getByRole('button', { name: 'Limpiar filtros' })
    await clearBtn.focus()
    await expect(clearBtn).toBeFocused()
  })
})
