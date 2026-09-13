import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:55174',
    trace: 'on-first-retry',
  },
  workers: 1,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.CI
    ? undefined
    : [
        {
          command:
            'cd ../backend && uv run --frozen python manage.py testserver tests/fixtures/e2e_identity.json --noinput --settings config.settings.e2e --addrport 127.0.0.1:8001',
          url: 'http://127.0.0.1:8001/api/v1/health/',
          reuseExistingServer: false,
          timeout: 120_000,
        },
        {
          command:
            'VITE_PROXY_TARGET=http://127.0.0.1:8001 npm run dev -- --port 55174',
          url: 'http://127.0.0.1:55174',
          reuseExistingServer: false,
        },
      ],
})
