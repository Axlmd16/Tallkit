import { expect, test } from '@playwright/test'

import { COMPONENT_REGISTRY } from '../../src/dev/visual-catalog/registry'

function kebabCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

test.describe('regresión visual contra evidencia aprobada', () => {
  test.skip(
    process.env.CATALOG_APPROVED !== '1',
    'Los baselines solo se comparan o promueven tras aceptación visual explícita.',
  )

  for (const component of COMPONENT_REGISTRY) {
    test(`${component.id} — ${component.name}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(`/visual-catalog.html#isolate=true&id=${component.id}`)

      const region = page.getByTestId('isolated-view')
      await expect(region).toBeVisible()
      await expect(region).toHaveScreenshot(
        `${component.id}-${kebabCase(component.name)}.png`,
      )
    })
  }
})
