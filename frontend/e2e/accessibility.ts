import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter(({ impact }) =>
    ['serious', 'critical'].includes(impact ?? ''),
  )
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([])
}
