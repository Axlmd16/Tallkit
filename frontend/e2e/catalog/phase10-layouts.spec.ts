import path from 'node:path'
import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from '../accessibility'

const evidenceDir =
  process.env.CATALOG_EVIDENCE_DIR ??
  '/home/axlmd/.gemini/antigravity-cli/brain/0c543b8a-6ffb-4792-b753-81178d325de2/scratch/evidence'

const phase10EvidenceDir = path.join(evidenceDir, 'phase10-layouts')

const viewports = [
  { width: 360, height: 700, name: '360' },
  { width: 768, height: 900, name: '768' },
  { width: 1024, height: 900, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
]

test.describe('Fase 10: Layouts de Acceso y Vista Previa (C33, C43)', () => {
  const components = [
    { id: 'C33', name: 'preview-layout', ref: 'F09_4-4240_4-4315' },
    { id: 'C43', name: 'auth-layout', ref: 'F17_4-8585_F18_4-8485' },
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
            phase10EvidenceDir,
            `${comp.name}-${vp.name}-${comp.ref}.png`,
          ),
        })

        await expectNoSeriousAccessibilityViolations(page)
      }
    })
  }

  test('verificación interactiva de PreviewLayout (C33): alternancia móvil, texto largo y edición', async ({
    page,
  }) => {
    // Probar a 360px (móvil)
    await page.setViewportSize({ width: 360, height: 700 })
    await page.goto('/visual-catalog.html#isolate=true&id=C33')

    const viewDocBtn = page.getByRole('button', { name: 'Ver documento' })
    const viewEditorBtn = page.getByRole('button', { name: 'Ver editor' })

    await expect(viewDocBtn).toBeVisible()
    await expect(viewEditorBtn).toBeVisible()

    // Inicialmente el editor está activo
    const editorRegion = page.getByRole('region', {
      name: 'Editor de configuración',
    })
    await expect(editorRegion).toBeVisible()

    // Alternar a vista previa del documento
    await viewDocBtn.click()
    const previewRegion = page.getByRole('region', {
      name: 'Vista previa del documento',
    })
    await expect(previewRegion).toBeVisible()
    await expect(editorRegion).not.toBeVisible()

    // Alternar de vuelta a editor
    await viewEditorBtn.click()
    await expect(editorRegion).toBeVisible()
    await expect(previewRegion).not.toBeVisible()

    // Probar en pantalla grande (1440px): ambos paneles visibles simultáneamente
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(editorRegion).toBeVisible()
    await expect(previewRegion).toBeVisible()

    // Probar edición reactiva de observaciones con texto largo
    const textarea = page.getByLabel('Observaciones técnicas')
    await textarea.fill(
      'Texto extenso de prueba para verificar que el layout contiene adecuadamente observaciones técnicas sin romper márgenes ni generar desbordamiento horizontal inesperado.',
    )

    // El documento previo refleja el texto
    await expect(
      previewRegion.getByText(/Texto extenso de prueba para verificar/i),
    ).toBeVisible()
  })

  test('verificación de AuthLayout (C43): columnas 448px/348px y omisión de login social o imágenes ajenas', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C43')

    const authMain = page.getByRole('main')
    await expect(authMain).toBeVisible()
    await expect(authMain).toHaveClass(/max-w-\[448px\]/)

    const formContainer = page.getByTestId('auth-form-container')
    await expect(formContainer).toHaveClass(/max-w-\[348px\]/)

    // Comprobar ausencia de login social o enlaces externos prohibidos
    await expect(
      page.getByRole('button', { name: /google/i }),
    ).not.toBeVisible()
    await expect(
      page.getByRole('button', { name: /facebook/i }),
    ).not.toBeVisible()

    // Comprobar ausencia de imágenes importadas o ilustraciones demo ajenas
    const imageCount = await authMain.locator('img').count()
    expect(imageCount).toBe(0)

    // Probar alternancia de variantes
    const shortBtn = page.getByRole('button', {
      name: 'Variante corta (login)',
    })
    const extendedBtn = page.getByRole('button', {
      name: 'Variante extendida (recuperación)',
    })

    await extendedBtn.click()
    await expect(
      page.getByText('Restablecimiento seguro de credenciales'),
    ).toBeVisible()
    await expect(page.getByLabel('Confirmar contraseña')).toBeVisible()

    await shortBtn.click()
    await expect(page.getByText('Inicie sesión en su cuenta')).toBeVisible()
    await expect(page.getByLabel('Confirmar contraseña')).not.toBeVisible()
  })
})
