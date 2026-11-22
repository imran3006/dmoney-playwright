import { expect, type Page } from '@playwright/test';
import type { AgentData } from '../utils/testData';

export class RegisterPage {
  constructor(private readonly page: Page) {}

  get fullName() { return this.page.getByLabel('Full Name'); }
  get email() { return this.page.getByLabel('Email Address'); }
  get password() { return this.page.getByLabel('Password'); }
  get phone() { return this.page.getByLabel('Phone Number'); }
  get nid() { return this.page.getByLabel('National ID (NID)'); }
  get roleSelect() { return this.page.getByRole('combobox'); }
  get createButton() { return this.page.getByRole('button', { name: 'Create Account →' }); }
  get successAlert() { return this.page
    .getByRole('alert')
    .filter({ hasText: 'Registration successful' }); }

  /** Landing page → header "Sign Up" link → /register */
  async openFromHome(): Promise<void> {
    await this.page.goto('/');
    await this.page.getByRole('link', { name: 'Sign Up' }).first().click();
    await this.page.waitForURL(/\/register/);
    await expect(this.createButton).toBeVisible();
  }

  async register(user: AgentData, role: 'Agent' | 'Customer' | 'Merchant'): Promise<void> {
    await this.fullName.fill(user.name);
    await this.email.fill(user.email);
    await this.password.fill(user.password);
    await this.phone.fill(user.phone);
    await this.nid.fill(user.nid);
    await this.roleSelect.click();
    await this.page.getByRole('option', { name: new RegExp(role) }).click();
    await expect(this.roleSelect).toContainText(role);
    await this.createButton.click();
  }
}
