import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../scripts',
  testMatch: 'generate-screenshots.ts',
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
});
