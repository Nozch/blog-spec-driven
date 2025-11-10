import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function resolveDevCommand(): string {
  const pkgPath = join(__dirname, 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
    if (pkg.scripts?.dev) {
      return pkg.scripts.dev;
    }
  } catch {
    // ignore and use fallback
  }
  return 'pnpm dev';
}

const devCommand = resolveDevCommand();

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: devCommand,
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
