import { defineConfig, devices } from '@playwright/test'
import { dashboardBaseUrl, widgetOrigin } from './e2e.config'

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',

  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],

  use: {
    baseURL: dashboardBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'node scripts/serve-widget.mjs 5500',
    url: widgetOrigin,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      BUGSHOT_API_URL: 'http://localhost:8085',
    },
  },
})
