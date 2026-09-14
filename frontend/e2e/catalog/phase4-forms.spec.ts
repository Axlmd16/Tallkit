import path from 'node:path'
import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from '../accessibility'

const evidenceDir =
  process.env.CATALOG_EVIDENCE_DIR ??
  '/home/axlmd/.gemini/antigravity-cli/brain/0c543b8a-6ffb-4792-b753-81178d325de2/scratch/evidence'

const phase4EvidenceDir = path.join(evidenceDir, 'phase4-forms')

const viewports = [
  { width: 360, height: 700, name: '360' },
  { width: 768, height: 900, name: '768' },
  { width: 1024, height: 900, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
]

test.describe('Fase 4: Campos y Controles (C05–C12)', () => {
  const components = [
    { id: 'C05', name: 'field', ref: 'F08_4-3262' },
    { id: 'C06', name: 'input', ref: 'F08_4-3264_F10_4-5440' },
    { id: 'C07', name: 'select', ref: 'F08_4-3278_F10_4-5429' },
    { id: 'C08', name: 'checkbox', ref: 'F18_4-8495' },
    { id: 'C09', name: 'field-error', ref: 'A_WCAG' },
    { id: 'C10', name: 'textarea', ref: 'F10_4-5412' },
    { id: 'C11', name: 'password-input', ref: 'F17_4-9228' },
    { id: 'C12', name: 'search-input', ref: 'F03_4-1024' },
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
            phase4EvidenceDir,
            `${comp.name}-${vp.name}-${comp.ref}.png`,
          ),
        })

        await expectNoSeriousAccessibilityViolations(page)
      }
    })
  }

  test('verificación de interacción por teclado en PasswordInput y SearchInput', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // C11: PasswordInput toggle de visibilidad por teclado
    await page.goto('/visual-catalog.html#isolate=true&id=C11')
    const passInput = page.getByLabel('Contraseña de usuario')
    await expect(passInput).toHaveAttribute('type', 'password')

    const toggleButton = page
      .getByRole('button', { name: 'Mostrar contraseña' })
      .first()
    await toggleButton.focus()
    await page.keyboard.press('Enter')
    await expect(passInput).toHaveAttribute('type', 'text')

    // C12: SearchInput escritura y limpieza por teclado
    await page.goto('/visual-catalog.html#isolate=true&id=C12')
    const searchInput = page.getByPlaceholder(
      'Buscar por placa, cliente o factura...',
    )
    await searchInput.focus()
    const clearButton = page.getByRole('button', { name: 'Limpiar búsqueda' })
    await expect(clearButton).toBeVisible()
    await clearButton.focus()
    await page.keyboard.press('Enter')
    await expect(searchInput).toHaveValue('')
    await expect(searchInput).toBeFocused()
  })
})
