import { expect, type Page } from '@playwright/test';
import { parseAmount } from '../utils/testData';

export interface StatementTable {
  headers: string[];
  rows: string[][];
}

/** Agent → Self Statement (/agent/self-statement). */
export class SelfStatementPage {
  constructor(private readonly page: Page) {}

  get balanceHeading() { return this.page.getByText(/Current Balance: BDT/).first(); }
  get table() { return this.page.getByRole('table'); }
  get emptyState() { return this.page.getByText('No transactions found for the selected date range.'); }
  get nextPage() { return this.page.getByRole('button', { name: 'Go to next page' }); }

  async open(): Promise<void> {
    await this.page.getByRole('link', { name: 'Self Statement', exact: true }).click();
    await this.page.waitForURL(/\/agent\/self-statement/);
    await this.waitForTable();
    await expect(this.balanceHeading).toBeVisible();
  }

  /**
   * The statement API is sometimes very slow on the shared server (the System account has
   * 27k+ transactions) and the page shows only a spinner meanwhile. Wait up to 45 s, then
   * reload once and wait again.
   */
  private async waitForTable(): Promise<void> {
    const header = this.page.getByRole('columnheader', { name: 'Transaction ID' });
    try {
      await expect(header).toBeVisible({ timeout: 45_000 });
    } catch {
      console.log('  [self-statement] still loading after 45s, reloading the page once');
      await this.page.reload();
      await expect(header).toBeVisible({ timeout: 45_000 });
    }
  }

  async currentBalance(): Promise<number> {
    return parseAmount(await this.balanceHeading.innerText());
  }

  /**
   * Read every row on every page of the statement table (up to maxPages pages; the System
   * account has 27k+ transactions, so keep maxPages small there).
   */
  async extractAll(maxPages = 10): Promise<StatementTable> {
    const headers = (await this.table.getByRole('columnheader').allInnerTexts()).map((h) => h.trim());
    const rows: string[][] = [];
    const range = this.page.getByText(/^\d+–\d+ of \d+$/);
    for (let pageNo = 0; pageNo < maxPages; pageNo++) {
      const bodyRows = this.table.locator('tbody tr');
      const count = await bodyRows.count();
      for (let i = 0; i < count; i++) {
        const cells = (await bodyRows.nth(i).locator('td').allInnerTexts()).map((c) => c.trim());
        if (cells.length === headers.length) rows.push(cells);
      }
      if (pageNo === maxPages - 1) break;
      if ((await this.nextPage.count()) === 0 || (await this.nextPage.isDisabled())) break;
      const before = await range.innerText();
      await this.nextPage.click();
      await expect(range).not.toHaveText(before); // wait for the next page to render
    }
    return { headers, rows };
  }

  /** Row (as a header → value object) whose Transaction ID equals trnxId. */
  static findRow(table: StatementTable, trnxId: string): Record<string, string> | undefined {
    const idCol = table.headers.indexOf('Transaction ID');
    const row = table.rows.find((r) => r[idCol] === trnxId);
    return row ? Object.fromEntries(table.headers.map((h, i) => [h, row[i]])) : undefined;
  }
}
