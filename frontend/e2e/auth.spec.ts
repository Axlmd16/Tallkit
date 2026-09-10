import { expect, test } from '@playwright/test'

import { login, logout } from './helpers'

for (const username of [
  'admin_e2e',
  'vendedor_e2e',
  'taller_e2e',
  'multirrol_e2e',
]) {
  test(`login, authorized navigation and logout: ${username}`, async ({
    page,
  }) => {
    await login(page, username)
    await expect(page.getByText(username, { exact: false })).toBeVisible()
    if (username === 'admin_e2e') {
      await expect(page.getByRole('link', { name: 'Usuarios' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Auditoría' })).toBeVisible()
    } else {
      await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0)
    }
    if (username === 'multirrol_e2e') {
      await expect(
        page.getByText(
          /(Vendedor.*Encargado del taller|Encargado del taller.*Vendedor)/,
        ),
      ).toBeVisible()
    }
    await logout(page)
  })
}
