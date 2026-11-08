import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 4,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4181', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome', defaultBrowserType: 'chromium' } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], browserName: 'webkit', viewport: { width: 1699, height: 1240 } } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'pwa', testDir: './tests/pwa', use: { baseURL: 'http://127.0.0.1:4182/Wunschnagel/', ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
  webServer: [
    { command: 'npm run dev -- --port 4181 --strictPort', url: 'http://127.0.0.1:4181', reuseExistingServer: !process.env.CI },
    { command: 'npm run build && npm run preview -- --port 4182 --strictPort', env: { VITE_BASE_PATH: '/Wunschnagel/' }, url: 'http://127.0.0.1:4182/Wunschnagel/', reuseExistingServer: !process.env.CI },
  ],
})
