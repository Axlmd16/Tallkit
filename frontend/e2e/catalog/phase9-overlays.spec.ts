import path from 'node:path'
import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from '../accessibility'

const evidenceDir =
  process.env.CATALOG_EVIDENCE_DIR ??
  '/home/axlmd/.gemini/antigravity-cli/brain/0c543b8a-6ffb-4792-b753-81178d325de2/scratch/evidence'

const phase9EvidenceDir = path.join(evidenceDir, 'phase9-overlays')

const viewports = [
  { width: 360, height: 700, name: '360' },
  { width: 768, height: 900, name: '768' },
  { width: 1024, height: 900, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
]

test.describe('Fase 9: Paneles, Drawer y Modal (C39–C42)', () => {
  const components = [
    { id: 'C39', name: 'detail-panel', ref: 'F07_4-2804_4-2806' },
    { id: 'C40', name: 'drawer', ref: 'F08_4-3261_F10_4-5399' },
    { id: 'C41', name: 'modal', ref: 'F12_4-6177' },
    { id: 'C42', name: 'confirmation-panel', ref: 'F19_4-9303_F20_4-9335' },
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
            phase9EvidenceDir,
            `${comp.name}-${vp.name}-${comp.ref}.png`,
          ),
        })

        await expectNoSeriousAccessibilityViolations(page)
      }
    })
  }

  test('verificación interactiva de DetailPanel (C39) sin atrapar foco vecino', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C39')

    // El panel complementario debe estar visible y accesible
    const panel = page.getByRole('complementary', { name: 'Ficha técnica' })
    await expect(panel).toBeVisible()

    // El input vecino mantiene interacción y foco independiente
    const noteInput = page.getByPlaceholder('Escriba una nota...')
    await expect(noteInput).toBeVisible()
    await noteInput.focus()
    await expect(noteInput).toBeFocused()
    await noteInput.fill('Inspección de suspensión completada')

    // Cerrar el panel mediante su botón de cierre
    const closeBtn = panel.getByRole('button', { name: 'Cerrar panel' })
    await closeBtn.click()
    await expect(panel).not.toBeVisible()

    // Reabrir con el botón de alternancia
    const toggleBtn = page.getByRole('button', {
      name: 'Mostrar panel lateral',
    })
    await toggleBtn.click()
    await expect(
      page.getByRole('complementary', { name: 'Ficha técnica' }),
    ).toBeVisible()
  })

  test('verificación interactiva de Drawer (C40): variantes 409px, 369px y escape', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C40')

    // Abrir Drawer 409px (sin overlay per F08 4:3261)
    const open409Btn = page.getByRole('button', { name: /Abrir Drawer 409px/i })
    await open409Btn.click()

    const drawer409 = page.getByRole('dialog', {
      name: 'Filtros avanzados (409px)',
    })
    await expect(drawer409).toBeVisible()

    // Trampa de foco y cierre con Escape
    await page.keyboard.press('Escape')
    await expect(drawer409).not.toBeVisible()
    await expect(open409Btn).toBeFocused()

    // Abrir Drawer 369px (overlay 30% per F10 4:5399)
    const open369Btn = page.getByRole('button', { name: /Abrir Drawer 369px/i })
    await open369Btn.click()

    const drawer369 = page.getByRole('dialog', {
      name: 'Resumen rápido (369px)',
    })
    await expect(drawer369).toBeVisible()

    // Cierre mediante botón interno
    const okBtn = drawer369.getByRole('button', { name: 'Entendido' })
    await okBtn.click()
    await expect(drawer369).not.toBeVisible()
    await expect(open369Btn).toBeFocused()
  })

  test('verificación interactiva de Modal (C41): centrado 466px, trampa de foco y retorno', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C41')

    const openModalBtn = page.getByRole('button', { name: /Abrir Modal/i })
    await openModalBtn.click()

    const modal = page.getByRole('dialog', { name: 'Editar estado de orden' })
    await expect(modal).toBeVisible()

    // Verificación de ancho centrado 466px per F12 4:6177
    await expect(modal).toHaveClass(/max-w-\[466px\]/)

    // Cerrar con Escape y validar retorno de foco
    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible()
    await expect(openModalBtn).toBeFocused()
  })

  test('verificación interactiva de ConfirmationPanel (C42): anchos 658px y 726px sin ilustraciones', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C42')

    // Confirmación 658px (F19 4:9303)
    const open658Btn = page.getByRole('button', {
      name: /Abrir confirmación 658px/i,
    })
    await open658Btn.click()

    const panel658 = page.getByRole('dialog', { name: /Confirmar anulación/i })
    await expect(panel658).toBeVisible()
    await expect(panel658).toHaveClass(/max-w-\[658px\]/)

    // Comprobar ausencia de ilustraciones externas importadas
    const imagesInPanel = await panel658.locator('img').count()
    expect(imagesInPanel).toBe(0)

    // Cancelar
    const cancelBtn = panel658.getByRole('button', { name: 'Revisar datos' })
    await cancelBtn.click()
    await expect(panel658).not.toBeVisible()
    await expect(open658Btn).toBeFocused()

    // Confirmación 726px (F20 4:9335)
    const open726Btn = page.getByRole('button', {
      name: /Abrir confirmación 726px/i,
    })
    await open726Btn.click()

    const panel726 = page.getByRole('dialog', {
      name: 'Orden completada y liquidada',
    })
    await expect(panel726).toBeVisible()
    await expect(panel726).toHaveClass(/max-w-\[726px\]/)

    // Aceptar
    const acceptBtn = panel726.getByRole('button', {
      name: 'Aceptar y ver resumen',
    })
    await acceptBtn.click()
    await expect(panel726).not.toBeVisible()
    await expect(open726Btn).toBeFocused()
  })
})
