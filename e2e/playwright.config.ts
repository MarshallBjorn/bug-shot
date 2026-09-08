import { defineConfig, devices } from '@playwright/test'
import {
  admin,
  apiBaseUrl,
  attachmentsPath,
  connectionString,
  dashboardBaseUrl,
  dashboardPortNumber,
  demoProjectId,
  signingKey,
  widgetOrigin,
} from './e2e.config'

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',

  // testy dziela jedna baze i jedno konto administratora
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: dashboardBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      command: 'dotnet run --project ../backend/BugShot.Api/BugShot.Api.csproj --no-launch-profile',
      // dokument OpenAPI jest jedyna trasa bez tokena ktora odpowiada 200
      url: `${apiBaseUrl}/openapi/v1.json`,
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        ASPNETCORE_URLS: apiBaseUrl,
        ConnectionStrings__DefaultConnection: connectionString,
        Storage__AttachmentsPath: attachmentsPath,
        JWT_SIGNING_KEY: signingKey,
        ADMIN_EMAIL: admin.email,
        ADMIN_PASSWORD: admin.password,
        Cors__WidgetOrigins__0: widgetOrigin,
        Cors__DashboardOrigins__0: dashboardBaseUrl,
      },
    },
    {
      command: `npm run dev -- --port ${dashboardPortNumber} --strictPort`,
      cwd: '../frontend',
      url: dashboardBaseUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        VITE_API_BASE_URL: apiBaseUrl,
        VITE_PROJECT_ID: demoProjectId,
      },
    },
  ],
})
