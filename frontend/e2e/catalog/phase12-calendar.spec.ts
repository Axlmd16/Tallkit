import path from 'node:path'
import { expect, test } from '@playwright/test'

import { expectNoSeriousAccessibilityViolations } from '../accessibility'

const evidenceDir =
  process.env.CATALOG_EVIDENCE_DIR ??
  '/home/axlmd/.gemini/antigravity-cli/brain/0c543b8a-6ffb-4792-b753-81178d325de2/scratch/evidence'

const phase12EvidenceDir = path.join(evidenceDir, 'phase12-calendar')

const viewports = [
  { width: 360, height: 700, name: '360' },
  { width: 768, height: 900, name: '768' },
  { width: 1024, height: 900, name: '1024' },
  { width: 1440, height: 900, name: '1440' },
]

test.describe('Fase 12: Calendarios (C55–C59)', () => {
  const components = [
    { id: 'C55', name: 'calendar-toolbar', ref: 'F21_4-5456' },
    { id: 'C56', name: 'mini-calendar', ref: 'F05_4-2042' },
    { id: 'C57', name: 'month-calendar', ref: 'F21_4-5474' },
    { id: 'C58', name: 'year-calendar', ref: 'F14_4-6578' },
    { id: 'C59', name: 'day-calendar', ref: 'F16_4-3943' },
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
            phase12EvidenceDir,
            `${comp.name}-${vp.name}-${comp.ref}.png`,
          ),
        })

        await expectNoSeriousAccessibilityViolations(page)
      }
    })
  }

  test('verificación interactiva de CalendarToolbar (C55): alternancia de vistas y orquestación', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C55')

    const orchestration = page.getByTestId('calendar-orchestration-demo')
    await expect(orchestration).toBeVisible()

    // Vista inicial es mes
    const viewIndicator = page.getByTestId('current-view-indicator')
    await expect(viewIndicator).toHaveText('month')

    const selectedIndicator = page.getByTestId('selected-date-indicator')
    const day25 = orchestration.getByRole('gridcell', {
      name: '25 de septiembre de 2026',
    })
    await day25.click()
    await expect(selectedIndicator).toHaveText('2026-09-25')

    // Cambiar a vista día conserva la selección
    const dayBtn = orchestration.getByRole('button', { name: 'Día' })
    await dayBtn.click()
    await expect(viewIndicator).toHaveText('day')
    await expect(
      orchestration.getByRole('region', { name: /calendario diario/i }),
    ).toBeVisible()
    await expect(selectedIndicator).toHaveText('2026-09-25')

    // Cambiar a vista año
    const yearBtn = orchestration.getByRole('button', { name: 'Año' })
    await yearBtn.click()
    await expect(viewIndicator).toHaveText('year')
    await expect(
      orchestration.getByRole('region', { name: /calendario anual/i }),
    ).toBeVisible()
    await expect(
      orchestration.getByRole('button', { name: '25 de septiembre de 2026' }),
    ).toHaveAttribute('aria-pressed', 'true')

    // En vista año, hacer clic en un mes (por ejemplo "Mayo") para volver a vista mes
    const mayBtn = orchestration.getByRole('button', { name: 'Ver mayo' })
    await expect(mayBtn).toBeVisible()
    await mayBtn.click()
    await expect(viewIndicator).toHaveText('month')
  })

  test('verificación interactiva de MiniCalendar (C56): navegación, selección y año bisiesto', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C56')

    const selectedIndicator = page.getByTestId('mini-calendar-selected')
    await expect(selectedIndicator).toContainText('2026-09-13')

    // Navegar al mes siguiente usando el botón de cabecera
    const nextBtn = page.getByRole('button', { name: 'Mes siguiente' }).first()
    await nextBtn.click()
    await expect(page.getByText('Octubre 2026')).toBeVisible()

    // Seleccionar el día 15 de octubre
    const day15 = page.getByRole('button', { name: '15 de octubre de 2026' })
    await expect(day15).toBeVisible()
    await day15.click()
    await expect(selectedIndicator).toContainText('2026-10-15')

    // Verificar año bisiesto 2028: debe existir el día 29 de febrero
    const leapDay29 = page.getByRole('button', {
      name: '29 de febrero de 2028',
    })
    await expect(leapDay29).toBeVisible()
  })

  test('verificación de MonthCalendar (C57): selección de fecha y eventos', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C57')

    const dateIndicator = page.getByTestId('month-selected-date')
    await expect(dateIndicator).toHaveText('2026-09-14')

    // Seleccionar día 25 de septiembre
    const day25 = page.getByRole('gridcell', {
      name: '25 de septiembre de 2026',
    })
    await expect(day25).toBeVisible()
    await day25.click()
    await expect(dateIndicator).toHaveText('2026-09-25')

    // Clic en bloque neutral "Elemento A"
    const eventBtn = page.getByRole('button', { name: /Elemento A/i })
    await expect(eventBtn).toBeVisible()
    await eventBtn.click()

    const eventIndicator = page.getByTestId('month-selected-event')
    await expect(eventIndicator).toBeVisible()
    await expect(eventIndicator).toContainText('Elemento A')
  })

  test('verificación de YearCalendar (C58): 12 meses visibles e interactivos', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C58')

    // Verificar que los 12 meses estén presentes
    const monthNames = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ]

    for (const m of monthNames) {
      await expect(
        page.getByRole('button', { name: `Ver ${m.toLowerCase()}` }),
      ).toBeVisible()
    }

    // Clic en "Ver julio"
    await page.getByRole('button', { name: 'Ver julio' }).click()
    const monthIndicator = page.getByTestId('year-selected-month')
    await expect(monthIndicator).toContainText('2026-07')
  })

  test('verificación de DayCalendar (C59): franjas horarias y eventos con columnas', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto('/visual-catalog.html#isolate=true&id=C59')

    // Verificar eje horario
    await expect(page.getByText('08:00', { exact: true })).toBeVisible()
    await expect(page.getByText('12:00', { exact: true })).toBeVisible()
    await expect(page.getByText('18:00', { exact: true })).toBeVisible()

    // Clic en franja horaria vacía (por ejemplo 12:00)
    const slot12 = page.getByRole('button', { name: /franja de las 12:00/i })
    await expect(slot12).toBeVisible()
    await slot12.click()
    await expect(page.getByTestId('day-selected-slot')).toHaveText('12:00')

    // Clic en evento programado
    const eventA = page.getByRole('button', { name: /Bloque A/i })
    await expect(eventA).toBeVisible()
    await eventA.click()
    await expect(page.getByTestId('day-selected-event')).toContainText(
      'Bloque A',
    )
  })

  test('verificación de adaptación móvil 360px sin desbordamiento horizontal', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 700 })

    for (const compId of ['C55', 'C56', 'C57', 'C58', 'C59']) {
      await page.goto(`/visual-catalog.html#isolate=true&id=${compId}`)
      const isolated = page.getByTestId('isolated-view')
      await expect(isolated).toBeVisible()

      // Verificar que el ancho del scroll del documento sea igual al ancho del viewport (sin overflow horizontal roto)
      const scrollWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      )
      expect(scrollWidth).toBeLessThanOrEqual(365)
    }
  })
})
