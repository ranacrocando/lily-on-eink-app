import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173/lily-on-eink-app/',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // CI has built the app in an earlier step.
    command: `${process.env.CI ? '' : 'npm run build && '}npx vite preview --port 4173 --strictPort`,
    url: 'http://localhost:4173/lily-on-eink-app/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
