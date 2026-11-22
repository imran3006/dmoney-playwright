import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

const isCI = !!process.env.CI;

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Login OTPs and password-reset links are delivered by email only, so some tests need
 * a human (see utils/manualAssist.ts and README.md → "Manual-assist steps"). That means:
 *  - locally the browser runs HEADED, so you can type the OTP / paste the reset link;
 *  - one worker, so only one manual prompt appears at a time;
 *  - the `list` reporter, so the manual prompts are printed live in the terminal;
 *  - on CI (no screen, nobody to type) tests tagged @manual are skipped.
 */
export default defineConfig({
  testDir: './tests',
  // The shared backend is sometimes slow (login API took 13 s while testing), so allow
  // more than the 30 s default. The manual-assist helpers add their own wait time on top.
  timeout: 180_000, // room for one retry when the shared backend hangs
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: 0, // a retry would send another OTP/reset email and need the human again
  grepInvert: isCI ? /@manual/ : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://dmoneyportal.roadtocareer.net',
    headless: isCI,
    launchOptions: { slowMo: Number(process.env.SLOW_MO || 0) },
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
