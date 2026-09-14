import path from 'node:path'
import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from '../accessibility'

const evidenceDir =
  process.env.CATALOG_EVIDENCE_DIR ??
  '/home/axlmd/.gemini/antigravity-cli/brain/0c543b8a-6ffb-4792-b753-81178d325de2/scratch/evidence'

const phase11EvidenceDir = path.join(evidenceDir, 'phase11-charts')

const viewports = [
  { width: 360, height: 700, name: '360' },
  { width: 768, height: 900, name: '768' },
  { width: 1024, height: 900, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
]

test.describe('Fase 11: Gráficos y Progreso (C49–C54)', () => {
  const components = [
    { id: 'C49', name: 'chart-container', ref: 'F02_4-117_4-92_F11_4-4568' },
    { id: 'C50', name: 'line-area-chart', ref: 'F02_4-123_4-148_4-149' },
    { id: 'C51', name: 'donut-chart', ref: 'F02_4-104_F11_4-4581' },
    { id: 'C52', name: 'bar-chart', ref: 'F07_4-2819_F11_4-4729' },
    { id: 'C53', name: 'chart-legend', ref: 'F02_4-94_F11_4-4571' },
    { id: 'C54', name: 'progress', ref: 'F07_4-2877_F11_4-4732' },
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
            phase11EvidenceDir,
            `${comp.name}-${vp.name}-${comp.ref}.png`,
          ),
        })

        await expectNoSeriousAccessibilityViolations(page)
      }
    })
  }

  test('verificación interactiva de ChartContainer (C49): alternancia a tabla accesible y estado vacío', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C49')

    const tableToggleBtn = page.getByRole('button', {
      name: 'Ver tabla de datos',
    })
    await expect(tableToggleBtn).toBeVisible()

    // Alternar a vista tabular
    await tableToggleBtn.click()
    const table = page.locator('table')
    await expect(table).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Ver gráfico' }),
    ).toBeVisible()

    // Regresar a vista gráfica
    await page.getByRole('button', { name: 'Ver gráfico' }).click()
    await expect(table).not.toBeVisible()

    // Verificar contenedor vacío
    const emptyContainer = page.getByText(
      'No se registran datos para el periodo seleccionado.',
    )
    await expect(emptyContainer).toBeVisible()
  })

  test('verificación interactiva de LineAreaChart (C50): teclado, tooltip y puntos accesibles', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C50')

    const dataPoints = page.getByRole('button', { name: /Sem/i })
    await expect(dataPoints.first()).toBeVisible()

    // Foco por teclado en primer punto
    await dataPoints.first().focus()
    await expect(dataPoints.first()).toBeFocused()

    // Tooltip flotante al hacer hover o focus
    const tooltip = page.locator('[role="tooltip"]')
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toHaveText(/Sem 1: 24/)
  })

  test('verificación de DonutChart (C51): total en centro, segmentos accesibles y alternativa textual', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C51')

    // Centro con total y label
    await expect(page.getByText('100')).toBeVisible()
    await expect(page.getByText('Total Servicios')).toBeVisible()

    // Segmentos interactivos por teclado
    const segments = page.getByRole('button', {
      name: /mantenimiento preventivo/i,
    })
    await expect(segments.first()).toBeVisible()

    // Alternativa textual completa sin depender únicamente del color
    const textAlternative = page.getByTestId('donut-text-alternative').first()
    await expect(textAlternative).toContainText('Mantenimiento Preventivo: 52')
    await expect(textAlternative).toContainText('Reparación Mayor: 28')
  })

  test('verificación de BarChart (C52): orientaciones vertical y horizontal con teclado', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C52')

    // Barras verticales
    const monBar = page.getByRole('button', { name: /Lun: 45/i })
    await expect(monBar).toBeVisible()

    // Barras horizontales
    const brakesBar = page.getByRole('button', { name: /Frenos: 34/i })
    await expect(brakesBar).toBeVisible()

    // Foco y activación por teclado en barra
    await brakesBar.focus()
    await expect(brakesBar).toBeFocused()
    await page.keyboard.press('Enter')

    // Alternativa textual para lectores de pantalla
    const textAlt = page.getByTestId('barchart-text-alternative').first()
    await expect(textAlt).toContainText('Lun: 45')
  })

  test('verificación de ChartLegend (C53) y Progress (C54): semántica accesible y variantes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C53')

    const legendLists = page.getByRole('list')
    await expect(legendLists.first()).toBeVisible()
    await expect(page.getByText('Pendientes')).toBeVisible()
    await expect(page.getByText('Taller Norte')).toBeVisible()

    // Navegar a Progress
    await page.goto('/visual-catalog.html#isolate=true&id=C54')
    const progressbars = page.getByRole('progressbar')
    await expect(progressbars.first()).toBeVisible()

    // Verificar atributos semánticos en barra con valor 65
    const capProgress = page.getByRole('progressbar', {
      name: /capacidad de taller/i,
    })
    await expect(capProgress).toHaveAttribute('aria-valuenow', '65')
    await expect(capProgress).toHaveAttribute('aria-valuemin', '0')
    await expect(capProgress).toHaveAttribute('aria-valuemax', '100')

    // Verificar progreso circular
    const circularProgress = page.getByRole('progressbar', {
      name: /sm \(40%\)/i,
    })
    await expect(circularProgress).toBeVisible()
    await expect(circularProgress).toHaveAttribute('aria-valuenow', '40')
  })
})
