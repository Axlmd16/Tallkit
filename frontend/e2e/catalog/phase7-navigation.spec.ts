import path from 'node:path'
import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from '../accessibility'

const evidenceDir =
  process.env.CATALOG_EVIDENCE_DIR ??
  '/home/axlmd/.gemini/antigravity-cli/brain/0c543b8a-6ffb-4792-b753-81178d325de2/scratch/evidence'

const phase7EvidenceDir = path.join(evidenceDir, 'phase7-navigation')

const viewports = [
  { width: 360, height: 700, name: '360' },
  { width: 768, height: 900, name: '768' },
  { width: 1024, height: 900, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
]

test.describe('Fase 7: Navegación y Composiciones Generales (C22, C23, C25, C27–C32, C66)', () => {
  const components = [
    { id: 'C22', name: 'metric-card', ref: 'F01_4-506_F02_4-164' },
    { id: 'C23', name: 'detail-card', ref: 'F07_4-2807_F02_4-3' },
    { id: 'C25', name: 'avatar-group', ref: 'F06_4-2647' },
    { id: 'C27', name: 'sidebar', ref: 'F01_4-575_F02_4-233' },
    { id: 'C28', name: 'navigation-item', ref: 'F01_4-643' },
    { id: 'C29', name: 'app-frame', ref: 'F01_4-344_F02_4-2' },
    { id: 'C30', name: 'dashboard-layout', ref: 'F01_4-344_F02_4-164' },
    { id: 'C31', name: 'master-detail-layout', ref: 'F07_4-2804_F22_4-7439' },
    { id: 'C32', name: 'form-layout', ref: 'F09_4-4315_F08_4-3262' },
    { id: 'C66', name: 'media-slot', ref: 'F07_4-2807_F02_4-3' },
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
            phase7EvidenceDir,
            `${comp.name}-${vp.name}-${comp.ref}.png`,
          ),
        })

        await expectNoSeriousAccessibilityViolations(page)
      }
    })
  }

  test('verificación de foco e interacción por teclado en Sidebar y NavigationItem', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // NavigationItem (C28)
    await page.goto('/visual-catalog.html#isolate=true&id=C28')
    const activeItem = page.getByRole('button', { name: /Órdenes de Servicio/ })
    await expect(activeItem).toBeVisible()
    await expect(activeItem).toHaveAttribute('aria-current', 'page')

    const inactiveItem = page.getByRole('button', { name: /Métricas de Bahía/ })
    await inactiveItem.focus()
    await expect(inactiveItem).toBeFocused()

    // Sidebar (C27)
    await page.goto('/visual-catalog.html#isolate=true&id=C27')
    const sidebarNav = page
      .getByRole('navigation', { name: 'Navegación principal' })
      .first()
    await expect(sidebarNav).toBeVisible()

    const ordersItem = sidebarNav.getByRole('button', {
      name: /Órdenes de Trabajo/,
    })
    await expect(ordersItem).toHaveAttribute('aria-current', 'page')

    const vehiclesItem = sidebarNav.getByRole('button', {
      name: /Parque Automotor/,
    })
    await vehiclesItem.focus()
    await expect(vehiclesItem).toBeFocused()
  })

  test('verificación estructural en AppFrame, DashboardLayout y MasterDetailLayout', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // AppFrame (C29)
    await page.goto('/visual-catalog.html#isolate=true&id=C29')
    const mainRegion = page.getByRole('main')
    await expect(mainRegion).toBeVisible()
    const headerBanner = page.getByRole('banner')
    await expect(headerBanner).toBeVisible()
    const contentInfo = page.getByRole('contentinfo')
    await expect(contentInfo).toBeVisible()

    // DashboardLayout (C30)
    await page.goto('/visual-catalog.html#isolate=true&id=C30')
    const dashboard = page.getByRole('region', { name: 'Métricas clave' })
    await expect(dashboard).toBeVisible()

    // MasterDetailLayout (C31)
    await page.goto('/visual-catalog.html#isolate=true&id=C31')
    const masterSection = page.getByRole('region', {
      name: 'Tabla de registros',
    })
    await expect(masterSection).toBeVisible()
    const detailSection = page.getByRole('region', {
      name: 'Detalle del elemento seleccionado',
    })
    await expect(detailSection).toBeVisible()
  })
})
