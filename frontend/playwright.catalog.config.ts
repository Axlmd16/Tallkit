import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

const evidenceDir = process.env.CATALOG_EVIDENCE_DIR

if (!evidenceDir) {
  throw new Error(
    'CATALOG_EVIDENCE_DIR es obligatorio y debe apuntar fuera del repositorio.',
  )
}

export default defineConfig({
  testDir: './e2e/catalog',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  outputDir: path.join(evidenceDir, 'actual', 'playwright'),
  reporter: [
    ['html', { open: 'never', outputFolder: path.join(evidenceDir, 'report') }],
  ],
  snapshotPathTemplate: path.join(
    evidenceDir,
    'approved',
    '{testFilePath}',
    '{arg}{ext}',
  ),
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      maxDiffPixelRatio: 0.005,
      threshold: 0.2,
    },
  },
  use: {
    baseURL:
      process.env.PLAYWRIGHT_CATALOG_BASE_URL ?? 'http://127.0.0.1:55175',
    trace: 'on-first-retry',
  },
  workers: 1,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 },
    },
  ],
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
