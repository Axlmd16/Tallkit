import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/catalog',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_CATALOG_BASE_URL ?? 'http://127.0.0.1:55175',
    trace: 'on-first-retry',
  },
  workers: 1,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.CI
    ? undefined
    : [
        {
          command: 'npm run dev -- --port 55175',
          url: 'http://127.0.0.1:55175/visual-catalog.html',
          reuseExistingServer: false,
          timeout: 60_000,
        },
      ],
})
