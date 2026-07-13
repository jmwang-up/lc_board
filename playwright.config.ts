import { defineConfig, devices } from '@playwright/test';

const noProxy = [process.env.NO_PROXY, process.env.no_proxy, '127.0.0.1', 'localhost'].filter(Boolean).join(',');
process.env.NO_PROXY = noProxy;
process.env.no_proxy = noProxy;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev:web -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
