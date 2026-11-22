import { test, type Page } from '@playwright/test';

/**
 * Manual-assist helpers.
 *
 * dMoney sends login OTPs and password-reset links ONLY by email, and the API never
 * returns them. Instead of reading Gmail automatically, these helpers pause the test,
 * print a clear prompt in the terminal, and wait for a human to finish the step in
 * the (headed) browser window. See README.md → "Manual-assist steps".
 */

/** Dashboard URL the app redirects to after a successful login. */
const DASHBOARD_URL = /\/profile(?:[?#]|$)/;
/** Reset page opened from the email link: /reset-password?token=<64 hex chars>. */
const RESET_PAGE_URL = /\/reset-password\?(?:.*&)?token=[^&#]+/;

const LOGIN_ERROR_TEXT =
  /Login failed|cannot be empty|Network error|Please input correct/i;
const RESET_SENT_TEXT = /password reset link has been sent/i;
const RESET_ERROR_TEXT =
  /Please input registered phone number or email|Please enter your registered email|Something went wrong/i;

export type OtpOutcome = 'otp-entered' | 'no-otp';

export interface ManualWaitOptions {
  /** How long to wait for the human, in ms. */
  timeout?: number;
  /**
   * How long to wait for the app's first response after the click (dashboard / OTP
   * screen / error), in ms. The backend is sometimes slow: login took 13 s and the
   * follow-up profile lookup 5 s during testing.
   */
  detectTimeout?: number;
}

const DEFAULT_DETECT_TIMEOUT = 45_000;

/**
 * Call right after clicking "Login →".
 *
 * - Goes straight to /profile (no OTP, e.g. admin@dmoney.com) → returns 'no-otp'.
 * - OTP screen ("Verify Your Identity") appears → prints a prompt and waits up to
 *   120 s (default) for the human to type the OTP and click "Verify OTP →", i.e. for
 *   the URL to reach /profile → returns 'otp-entered'.
 * - Login error is shown → throws with that error text (no point waiting).
 */
export async function waitForManualOtp(
  page: Page,
  { timeout = 120_000, detectTimeout = DEFAULT_DETECT_TIMEOUT }: ManualWaitOptions = {},
): Promise<OtpOutcome> {
  extendTestTimeout(detectTimeout);
  const otpHeading = page.getByText('Verify Your Identity');
  const loginError = page.getByText(LOGIN_ERROR_TEXT);

  const first = await Promise.race([
    page.waitForURL(DASHBOARD_URL, { timeout: detectTimeout }).then(() => 'dashboard' as const),
    otpHeading.waitFor({ state: 'visible', timeout: detectTimeout }).then(() => 'otp' as const),
    loginError.first().waitFor({ state: 'visible', timeout: detectTimeout }).then(() => 'error' as const),
  ]).catch(() => 'timeout' as const);

  if (first === 'dashboard') return 'no-otp';

  if (first === 'error') {
    const message = (await loginError.first().textContent())?.trim();
    throw new Error(`waitForManualOtp: login failed before the OTP step: "${message}"`);
  }

  if (first === 'timeout') {
    throw new Error(
      `waitForManualOtp: after ${detectTimeout / 1000}s the page shows neither the dashboard ` +
        `(/profile) nor the OTP screen. Current URL: ${page.url()}`,
    );
  }

  // OTP screen is showing: hand over to the human.
  extendTestTimeout(timeout);
  await page.bringToFront();
  announce([
    'MANUAL STEP: OTP REQUIRED',
    'Enter the OTP from Gmail in the browser and click Verify',
    `(the code is 4 digits and valid for 2 minutes; waiting up to ${timeout / 1000}s)`,
  ]);

  try {
    await page.waitForURL(DASHBOARD_URL, { timeout });
  } catch {
    throw new Error(
      `waitForManualOtp: OTP was not completed within ${timeout / 1000}s ` +
        `(still on ${page.url()}). Re-run the test and enter the code from the newest email.`,
    );
  }
  log('OTP verified, dashboard reached. Continuing the test.');
  return 'otp-entered';
}

/**
 * Call right after clicking "Send Reset Link →".
 *
 * Confirms the "reset link has been sent" message, prints a prompt, then waits up to
 * 180 s (default) for the human to paste the emailed link into THIS browser tab's
 * address bar. Returns the reset token taken from the URL.
 */
export async function waitForManualResetLink(
  page: Page,
  { timeout = 180_000, detectTimeout = DEFAULT_DETECT_TIMEOUT }: ManualWaitOptions = {},
): Promise<string> {
  extendTestTimeout(detectTimeout);
  const sent = page.getByText(RESET_SENT_TEXT);
  const failed = page.getByText(RESET_ERROR_TEXT);

  const first = await Promise.race([
    sent.first().waitFor({ state: 'visible', timeout: detectTimeout }).then(() => 'sent' as const),
    failed.first().waitFor({ state: 'visible', timeout: detectTimeout }).then(() => 'error' as const),
  ]).catch(() => 'timeout' as const);

  if (first === 'error') {
    const message = (await failed.first().textContent())?.trim();
    throw new Error(`waitForManualResetLink: reset request failed: "${message}"`);
  }
  if (first === 'timeout') {
    throw new Error(
      `waitForManualResetLink: no "reset link has been sent" confirmation after ${detectTimeout / 1000}s. ` +
        `Current URL: ${page.url()}`,
    );
  }

  extendTestTimeout(timeout);
  await page.bringToFront();
  announce([
    'MANUAL STEP: RESET LINK REQUIRED',
    "Paste the reset link from Gmail into this browser's address bar",
    '(use the Playwright-controlled window, same tab, then press Enter;',
    ` waiting up to ${timeout / 1000}s; the link is single-use)`,
  ]);

  try {
    await page.waitForURL(RESET_PAGE_URL, { timeout });
  } catch {
    throw new Error(
      `waitForManualResetLink: reset page was not opened within ${timeout / 1000}s ` +
        `(still on ${page.url()}). Paste the link into the test browser's address bar, not your own browser.`,
    );
  }

  const token = new URL(page.url()).searchParams.get('token') ?? '';
  log('Reset page opened. Continuing the test.');
  return token;
}

/** Give the running test enough time for the manual wait (default test timeout is 30 s). */
function extendTestTimeout(ms: number): void {
  try {
    const info = test.info();
    if (info.timeout > 0) info.setTimeout(info.timeout + ms);
  } catch {
    // Called outside a running test (e.g. a global setup script). Nothing to extend.
  }
}

function announce(lines: string[]): void {
  const bar = '='.repeat(72);
  console.log(`\n${bar}\n${lines.map((l) => `  ${l}`).join('\n')}\n${bar}\n`);
}

function log(message: string): void {
  console.log(`  [manual-assist] ${message}`);
}
