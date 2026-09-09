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
      command: 'npm run gateway:build && RATE_LIMIT_MAX=2000 MAIL_PROVIDER=mock node olivia-gateway/dist/index.js',
      url: 'http://127.0.0.1:8787/health',
      reuseExistingServer: true,
    },
    {
      command: 'npm run build && npm run preview -- --port 5173',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL || undefined } },
  ],
})
