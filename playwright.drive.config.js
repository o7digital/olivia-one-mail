import { defineConfig, devices } from '@playwright/test'
import baseConfig from './playwright.config.js'

export default defineConfig({
  ...baseConfig,
  testMatch: 'drive.spec.js',
  projects: [
    { name: 'drive-chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL || undefined } },
    { name: 'drive-firefox', use: { ...devices['Desktop Firefox'] } },
  ],
})
