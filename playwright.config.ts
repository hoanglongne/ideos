import { defineConfig, devices } from '@playwright/test'

// Chạy bằng `npm run e2e`. Tự dựng bản build + Worker cục bộ (D1 giả, AI giả) ở cổng 8787.
// Mỗi bài dùng một trình duyệt mới (IndexedDB trống) và, khi cần đồng bộ, một mã đồng bộ mới.
const root = typeof process.getuid === 'function' && process.getuid() === 0

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:8787',
    trace: 'retain-on-failure',
    launchOptions: { args: root ? ['--no-sandbox'] : [] },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run e2e:serve',
    url: 'http://localhost:8787/api/v1/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
