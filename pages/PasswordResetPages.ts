import { expect, type Page } from '@playwright/test';
import { SERVER_TIMEOUT } from '../utils/testData';

/** /forgot-password and /reset-password?token=… */
export class PasswordResetPages {
  constructor(private readonly page: Page) {}

  get identifier() { return this.page.getByLabel('Email or Phone Number'); }
  get sendLinkButton() { return this.page.getByRole('button', { name: 'Send Reset Link →' }); }
  get linkSentMessage() { return this.page.getByText(/password reset link has been sent/i); }

  get newPassword() { return this.page.getByRole('textbox', { name: 'New Password', exact: true }); }
  get confirmPassword() { return this.page.getByLabel('Confirm New Password'); }
  get resetButton() { return this.page.getByRole('button', { name: 'Reset Password →' }); }
  get resetSuccess() { return this.page.getByText(/password has been reset successfully/i); }

  /** Login page → "Forgot password?" → request the reset email. */
  async requestResetLink(email: string): Promise<void> {
    await this.page.getByText('Forgot password?', { exact: true }).click();
    await this.page.waitForURL(/\/forgot-password/);
    await this.identifier.fill(email);
    await this.sendLinkButton.click();
  }

  /** On /reset-password?token=…: set the new password, wait for redirect to /login. */
  async setNewPassword(password: string): Promise<void> {
    await this.newPassword.fill(password);
    await this.confirmPassword.fill(password);
    await this.resetButton.click();
    await expect(this.resetSuccess).toBeVisible({ timeout: SERVER_TIMEOUT });
    await this.page.waitForURL(/\/login/);
  }
}
