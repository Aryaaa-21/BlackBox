const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  globalSetup: require.resolve('./tests/e2e/global-setup.cjs'),
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  outputDir: 'e2e-artifacts',
  reporter: [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: { args: ['--disable-gpu'] },
    ...devices['Desktop Chrome'],
  },
  projects: [
    { name: 'smoke', testMatch: /smoke\.spec\.cjs/ },
    { name: 'acceptance', testMatch: /acceptance\.spec\.cjs/ },
  ],
});
