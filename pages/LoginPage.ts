import { expect, type Page } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  get email() { return this.page.getByLabel('Email or Phone Number'); }
  get password() { return this.page.getByLabel('Password'); }
  get loginButton() { return this.page.getByRole('button', { name: 'Login →' }); }
  get forgotPassword() { return this.page.getByText('Forgot password?', { exact: true }); }
  get loginError() { return this.page.getByText(
    'Login failed. Please input correct email/phone number or password.',
  ); }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await expect(this.loginButton).toBeVisible();
  }

  /** Fill the form and click "Login →". Does NOT wait for the result (OTP may follow). */
  async submit(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.loginButton.click();
  }

  /** Login for accounts without OTP (admin, system) and wait for the dashboard. */
  async loginWithoutOtp(email: string, password: string): Promise<void> {
    await this.goto();
    await this.submit(email, password);
    try {
      await this.page.waitForURL(/\/profile/, { timeout: 45_000 });
    } catch {
      // The shared backend sometimes hangs on a request; click Login once more.
      if (!/\/login/.test(this.page.url())) throw new Error(`Unexpected page after login: ${this.page.url()}`);
      console.log('  [login] no response after 45s, submitting once more');
      await this.goto();
      await this.submit(email, password);
      await this.page.waitForURL(/\/profile/, { timeout: 45_000 });
    }
  }
}
