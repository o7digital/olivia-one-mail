import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run gateway:dev',
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
