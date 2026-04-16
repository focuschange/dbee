// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:8765',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'cd .. && ./gradlew bootRun',
    port: 8765,
    timeout: 60000,
    reuseExistingServer: true,
  },
});
