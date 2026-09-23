import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** Anchos representativos de la verificación visual (360, 768, 1024, 1280 y 1440 px). */
export const REPRESENTATIVE_WIDTHS = [360, 768, 1024, 1280, 1440] as const

export async function expectNoSeriousAccessibilityViolations(
  page: Page,
  options: { exclude?: string[] } = {},
) {
  const builder = new AxeBuilder({ page })
  for (const selector of options.exclude ?? []) builder.exclude(selector)
  const results = await builder.analyze()
  const blocking = results.violations.filter(({ impact }) =>
    ['serious', 'critical'].includes(impact ?? ''),
  )
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
}

/** La página no se desplaza en horizontal; el contenido ancho se desplaza dentro de su panel. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflowing = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth
      ? Array.from(document.querySelectorAll('body *'))
          .filter(
            (element) =>
              element.getBoundingClientRect().right > window.innerWidth + 1,
          )
          .slice(0, 5)
          .map((element) => element.outerHTML.slice(0, 160))
      : [],
  )
  expect(overflowing, overflowing.join('\n')).toEqual([])
}

/** Accesibilidad y ausencia de desplazamiento horizontal en el estado actual de la página. */
export async function expectAdaptableAndAccessible(page: Page) {
  await expectNoHorizontalOverflow(page)
  await expectNoSeriousAccessibilityViolations(page)
}
