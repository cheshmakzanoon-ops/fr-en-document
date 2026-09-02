import { defineConfig } from '@playwright/test';

/**
 * NorthSign E2E suite — Phase 5.5.
 *
 * Scope: the four standing gates (EN flow, FR flow, recipient-locale email
 * regression, consent/export/deletion) plus the fr-CA glossary guard.
 *
 * Runs against a locally started production app (`node build/server/main.js`)
 * with Postgres on 54320 and Inbucket on :2500 (SMTP) / :9000 (REST API).
 * Tests create ALL of their own state through the UI — the seed script is
 * never run (see .github/workflows/ci.yml).
 */
export default defineConfig({
  testDir: './e2e/northsign',
  fullyParallel: false,
  workers: 1,
  maxFailures: process.env.CI ? 10 : undefined,
  forbidOnly: !!process.env.CI,
  retries: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    viewport: { width: 1920, height: 1200 },
  },

  timeout: 120_000,

  /* The app is started and health-polled by CI before tests run; locally,
     start it with `npm run start -w @documenso/remix` first. */
});
