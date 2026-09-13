import { expect, test } from '@playwright/test'

test('applies the Figma type and color system in the rendered application', async ({
  page,
}) => {
  await page.goto('/login')

  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    'rgb(250, 250, 251)',
  )
  await expect(page.locator('body')).toHaveCSS('font-family', /Nunito/)

  const submit = page.getByRole('button', { name: 'Ingresar' })
  await expect(submit).toHaveCSS('background-color', 'rgb(96, 91, 255)')
})
