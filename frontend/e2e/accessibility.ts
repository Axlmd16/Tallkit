import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

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
