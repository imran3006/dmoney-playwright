import { expect, type Page } from '@playwright/test';
import { SERVER_TIMEOUT } from '../utils/testData';

/** Admin → User List (/admin/users) and User detail (/admin/users/{id}). */
export class AdminUsersPage {
  constructor(private readonly page: Page) {}

  get heading() { return this.page.getByRole('heading', { name: 'User List' }); }
  get searchButton() { return this.page.getByRole('button', { name: 'Search' }); }
  get emailInput() { return this.page.getByLabel('Enter Email'); }

  row(email: string) {
    return this.page.getByRole('row').filter({ hasText: email });
  }

  async open(): Promise<void> {
    await this.page.getByRole('link', { name: 'User List', exact: true }).click();
    await this.page.waitForURL(/\/admin\/users$/);
    await expect(this.heading).toBeVisible();
  }

  async searchByEmail(email: string): Promise<void> {
    await this.page.getByRole('combobox').first().click();
    await this.page.getByRole('option', { name: 'Search by Email' }).click();
    await this.emailInput.fill(email);
    await this.searchButton.click();
    await expect(this.row(email)).toBeVisible({ timeout: SERVER_TIMEOUT });
  }

  async statusOf(email: string): Promise<string> {
    const cells = this.row(email).getByRole('cell');
    // Columns: ID | Name | Email | Phone | Balance | Role | Status | Registered Date | Action
    return (await cells.nth(6).innerText()).trim();
  }

  // ---------- user detail ----------
  get editButton() { return this.page.getByRole('button', { name: 'Edit User' }); }
  get saveButton() { return this.page.getByRole('button', { name: 'Save Changes' }); }
  get updatedMessage() { return this.page.getByText('User updated successfully'); }

  async openUser(email: string): Promise<void> {
    await this.row(email).getByRole('button', { name: 'View' }).click();
    await this.page.waitForURL(/\/admin\/users\/\d+/);
    await expect(this.editButton).toBeVisible({ timeout: SERVER_TIMEOUT });
  }

  /** Status chip on the detail page ("PENDING" / "ACTIVE" / "SUSPENDED"). */
  statusChip(status: string) {
    return this.page.locator('.MuiChip-root').filter({ hasText: new RegExp(`^${status}$`, 'i') });
  }

  async setStatus(from: string, to: string): Promise<void> {
    await this.editButton.click();
    await this.page.getByRole('combobox').filter({ hasText: from }).click();
    await this.page.getByRole('option', { name: to, exact: true }).click();
    await this.saveButton.click();
    await expect(this.updatedMessage).toBeVisible({ timeout: SERVER_TIMEOUT });
  }
}
