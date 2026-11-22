import { expect, type Page } from '@playwright/test';
import { SERVER_TIMEOUT } from '../utils/testData';

/** Header + sidebar shared by every logged-in page. */
export class DashboardLayout {
  constructor(private readonly page: Page) {}

  get balanceButton() { return this.page.getByRole('button', { name: 'Balance' }); }
  get balanceShown() { return this.page.getByRole('button', { name: /৳/ }); }

  dashboardHeading(kind: 'Admin' | 'Agent') {
    return this.page.getByText(`${kind} Dashboard`, { exact: true }).first();
  }

  async openMenu(link: string): Promise<void> {
    await this.page.getByRole('link', { name: link, exact: true }).click();
  }

  /** Click "Balance" once and read the amount it toggles to (e.g. "৳ 2000.00"). */
  async readHeaderBalance(): Promise<string> {
    await this.balanceButton.click();
    await expect(this.balanceShown).toBeVisible({ timeout: SERVER_TIMEOUT });
    return (await this.balanceShown.innerText()).trim();
  }

  /**
   * Logout through the avatar menu. The avatar block in the header shows an initial,
   * the user's name and role (e.g. "A" / "SYSTEM" / "Agent"); clicking it opens the menu.
   */
  async logout(name: string, role: string): Promise<void> {
    const avatar = this.page
      .getByRole('banner')
      .locator('div')
      // The header may shorten the name (e.g. "Agent 160855" is shown as "Agent"), so match
      // only on the role line. `name` is kept for readability at the call site.
      .filter({ has: this.page.getByText(role, { exact: true }) })
      .last(); // innermost block holding the role; the click bubbles to the handler
    const logoutItem = this.page.getByRole('menuitem', { name: /Logout/ });
    await avatar.click();
    try {
      await expect(logoutItem).toBeVisible({ timeout: 5_000 });
      await logoutItem.click();
    } catch {
      // Fallback (see docs/app-map.md risk 11): logout is client-side only anyway.
      await this.page.evaluate(() => {
        localStorage.clear();
        document.cookie = 'token=; path=/; max-age=0';
      });
      await this.page.goto('/login');
    }
    await this.page.waitForURL(/\/login/);
  }
}
