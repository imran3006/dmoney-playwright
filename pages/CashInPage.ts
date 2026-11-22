import { expect, type Page } from '@playwright/test';
import { ENV } from '../utils/env';
import { SERVER_TIMEOUT } from '../utils/testData';

export interface DepositResult {
  status: number;
  message: string;
  trnxId: string;
  currentBalance?: number;
  body: Record<string, unknown>;
}

/** Agent/System → Cash In (/agent/cash-in). */
export class CashInPage {
  constructor(private readonly page: Page) {}

  get customerPhone() { return this.page.getByLabel('Customer Phone Number'); }
  get amount() { return this.page.getByLabel('Amount (BDT)'); }
  get submitButton() { return this.page.getByRole('button', { name: 'Cash In →' }); }

  async open(): Promise<void> {
    await this.page.getByRole('link', { name: 'Cash In', exact: true }).click();
    await this.page.waitForURL(/\/agent\/cash-in/);
    await expect(this.submitButton).toBeVisible();
  }

  /** Submit a cash-in and return the API result (POST /transaction/deposit). */
  async deposit(toPhone: string, amount: number): Promise<DepositResult> {
    await this.customerPhone.fill(toPhone);
    await this.amount.fill(String(amount));
    const responsePromise = this.page.waitForResponse(
      (r) => r.url().startsWith(`${ENV.apiUrl}/transaction/deposit`) && r.request().method() === 'POST',
      { timeout: SERVER_TIMEOUT },
    );
    await this.submitButton.click();
    const response = await responsePromise;
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      status: response.status(),
      message: String(body.message ?? ''),
      trnxId: String(body.trnxId ?? ''),
      currentBalance: body.currentBalance !== undefined ? Number(body.currentBalance) : undefined,
      body,
    };
  }
}
