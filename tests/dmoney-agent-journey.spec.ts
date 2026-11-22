import path from 'node:path';
import fs from 'node:fs';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { ENV } from '../utils/env';
import { AMOUNTS, SERVER_TIMEOUT, createAgentData, parseAmount, todayLocal, type AgentData } from '../utils/testData';
import { waitForManualOtp, waitForManualResetLink } from '../utils/manualAssist';
import { writeCsv, readCsv } from '../utils/csv';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardLayout } from '../pages/DashboardLayout';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { CashInPage, type DepositResult } from '../pages/CashInPage';
import { SelfStatementPage, type StatementTable } from '../pages/SelfStatementPage';
import { PasswordResetPages } from '../pages/PasswordResetPages';

/**
 * dMoney end-to-end Agent journey (assignment scenario, steps 1–20).
 *
 * Tags:
 *   @smoke    positive test cases (npm run test:smoke)
 *   @negative negative test cases (only in the full regression run)
 *   @manual   needs a human for the email OTP / reset link (skipped on CI)
 *
 * The tests run in order and share ONE browser page, so the whole journey is recorded in a
 * single video (videos/). If a step fails, the remaining steps are skipped.
 */
test.describe.configure({ mode: 'serial' });

test.describe('dMoney Agent journey', () => {
  let context: BrowserContext;
  let page: Page;

  // Pages
  let login: LoginPage;
  let register: RegisterPage;
  let layout: DashboardLayout;
  let users: AdminUsersPage;
  let cashIn: CashInPage;
  let statement: SelfStatementPage;
  let reset: PasswordResetPages;

  // State shared between the steps
  const agent: AgentData = createAgentData();
  let registerResponse: { status: number; body: any };
  let systemDeposit: DepositResult;
  let customerDeposit: DepositResult;
  let agentStatement: StatementTable;
  let csvPath: string;

  const expectedBalanceAfterCustomerDeposit =
    AMOUNTS.systemDeposit -
    AMOUNTS.customerDeposit +
    AMOUNTS.customerDeposit * AMOUNTS.agentCommissionRate; // 2000 - 500 + 12.5 = 1512.5

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    context = await browser.newContext({
      baseURL: ENV.baseUrl,
      viewport: { width: 1366, height: 768 },
      recordVideo: { dir: 'videos/', size: { width: 1366, height: 768 } },
    });
    page = await context.newPage();
    login = new LoginPage(page);
    register = new RegisterPage(page);
    layout = new DashboardLayout(page);
    users = new AdminUsersPage(page);
    cashIn = new CashInPage(page);
    statement = new SelfStatementPage(page);
    reset = new PasswordResetPages(page);
    console.log(`  Test agent for this run: ${agent.name} | ${agent.email} | ${agent.phone}`);
  });

  test.afterAll(async () => {
    const video = page.video();
    await context.close(); // the video file is written on close
    if (video) console.log(`  Video: ${await video.path()}`);
  });

  // ───────────────────────── Registration ─────────────────────────

  test('01 - Agent registration is successful @smoke', async () => {
    await register.openFromHome();
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith('/user/register') && r.request().method() === 'POST',
      { timeout: SERVER_TIMEOUT },
    );
    await register.register(agent, 'Agent');
    const response = await responsePromise;
    registerResponse = { status: response.status(), body: await response.json() };

    expect(registerResponse.status).toBe(201);
    await expect(register.successAlert).toContainText('Registration successful');
    await page.waitForURL(/\/login/); // app redirects to login after ~3 s
  });

  test('02 - Newly created Agent is initially inactive (pending) @smoke', async () => {
    expect(registerResponse.body.user.role).toBe('Agent');
    expect(registerResponse.body.user.email).toBe(agent.email);
    expect(registerResponse.body.user.status).toBe('pending');
    expect(registerResponse.body.message).toContain('pending approval');
  });

  // ───────────────────────── Admin ─────────────────────────

  test('03 - Admin login is successful @smoke', async () => {
    await login.loginWithoutOtp(ENV.admin.email, ENV.admin.password);
    await expect(layout.dashboardHeading('Admin')).toBeVisible();
    await expect(page.getByRole('link', { name: 'User List', exact: true })).toBeVisible();
  });

  test('04 - Newly created Agent appears in the Admin user list @smoke', async () => {
    await users.open();
    await users.searchByEmail(agent.email);
    const row = users.row(agent.email);
    await expect(row).toContainText(agent.name);
    await expect(row).toContainText(agent.phone);
    await expect(row).toContainText('Agent');
    expect(await users.statusOf(agent.email)).toBe('PENDING'); // still inactive in the UI
  });

  test('05 - Admin can activate the Agent @smoke', async () => {
    await users.openUser(agent.email);
    await expect(users.statusChip('PENDING')).toBeVisible();
    await users.setStatus('Pending', 'Active');
    await expect(users.statusChip('ACTIVE')).toBeVisible();
  });

  test('06 - Agent remains active after page reload @smoke', async () => {
    await page.reload();
    await expect(users.statusChip('ACTIVE')).toBeVisible();
    await expect(users.statusChip('PENDING')).toHaveCount(0);

    await layout.logout('Admin', 'Admin'); // step 6 of the scenario
    await expect(login.loginButton).toBeVisible();
  });

  // ───────────────────────── System ─────────────────────────

  test('07 - System login is successful @smoke', async () => {
    await login.loginWithoutOtp(ENV.system.email, ENV.system.password);
    // The System account uses the Agent dashboard (role Agent, phone "SYSTEM")
    await expect(layout.dashboardHeading('Agent')).toBeVisible();
    await expect(page.getByText('SYSTEM', { exact: true }).first()).toBeVisible();
  });

  test('08 - System can deposit 2000 Tk to the Agent @smoke', async () => {
    await cashIn.open();
    systemDeposit = await cashIn.deposit(agent.phone, AMOUNTS.systemDeposit);
    expect([200, 201], systemDeposit.message).toContain(systemDeposit.status);
    expect(systemDeposit.trnxId).toMatch(/^TXN[A-Z0-9]+$/);
    await expect(page.getByText(/successful/i).first()).toBeVisible({ timeout: SERVER_TIMEOUT });
  });

  test('09 - System deposit creates the correct transaction record @smoke', async () => {
    await statement.open();
    const systemStatement = await statement.extractAll(1); // newest 20 rows are enough
    const row = SelfStatementPage.findRow(systemStatement, systemDeposit.trnxId);
    expect(row, `trnxId ${systemDeposit.trnxId} not found in System statement`).toBeTruthy();
    expect(row!['Sender Account']).toBe('SYSTEM');
    expect(row!['Receiver Account']).toBe(agent.phone);
    expect(row!['Type']).toMatch(/Deposit/i);
    expect(parseAmount(row!['Debit']) || parseAmount(row!['Credit'])).toBe(AMOUNTS.systemDeposit);

    await layout.logout('SYSTEM', 'Agent'); // step 9 of the scenario
  });

  // ───────────────────────── Agent ─────────────────────────

  test('10 - Agent can log in after activation @smoke @manual', async () => {
    await login.goto();
    await login.submit(agent.email, agent.password);
    await waitForManualOtp(page);
    await expect(layout.dashboardHeading('Agent')).toBeVisible();
    await expect(page.getByText(agent.name, { exact: true }).first()).toBeVisible();
  });

  test('11 - Agent balance is exactly 2000 Tk @smoke @manual', async () => {
    const headerBalance = await layout.readHeaderBalance();
    expect(parseAmount(headerBalance)).toBe(AMOUNTS.systemDeposit);

    await statement.open();
    expect(await statement.currentBalance()).toBe(AMOUNTS.systemDeposit);
  });

  test('12 - Agent can deposit 500 Tk to an existing Customer @smoke @manual', async () => {
    await cashIn.open();
    customerDeposit = await cashIn.deposit(ENV.customerPhone, AMOUNTS.customerDeposit);
    expect([200, 201], customerDeposit.message).toContain(customerDeposit.status);
    expect(customerDeposit.trnxId).toMatch(/^TXN[A-Z0-9]+$/);
    // step 13 of the scenario: transaction completed successfully
    await expect(page.getByText(/successful/i).first()).toBeVisible({ timeout: SERVER_TIMEOUT });
  });

  test('13 - Agent balance is updated correctly after the transaction @smoke @manual', async () => {
    await statement.open();
    expect(await statement.currentBalance()).toBeCloseTo(expectedBalanceAfterCustomerDeposit, 2);
    if (customerDeposit.currentBalance !== undefined) {
      expect(customerDeposit.currentBalance).toBeCloseTo(expectedBalanceAfterCustomerDeposit, 2);
    }
  });

  test("14 - Customer deposit appears in the Agent's Self Statement @smoke @manual", async () => {
    agentStatement = await statement.extractAll();
    const row = SelfStatementPage.findRow(agentStatement, customerDeposit.trnxId);
    expect(row, `trnxId ${customerDeposit.trnxId} not found in Agent statement`).toBeTruthy();
    expect(row!['Sender Account']).toBe(agent.phone);
    expect(row!['Receiver Account']).toBe(ENV.customerPhone);
    expect(parseAmount(row!['Debit'])).toBe(AMOUNTS.customerDeposit);
  });

  test('15 - Agent logout works successfully @smoke @manual', async () => {
    await layout.logout(agent.name, 'Agent');
    await expect(login.loginButton).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    // protected page is no longer reachable
    await page.goto('/agent/self-statement');
    await page.waitForURL(/\/login/);
  });

  test('16 - Agent password reset works successfully @smoke @manual', async () => {
    await login.goto();
    await reset.requestResetLink(agent.email);
    await waitForManualResetLink(page); // human pastes the emailed link
    await reset.setNewPassword(agent.newPassword);
  });

  test('17 - Login with the old password fails after reset @negative @manual', async () => {
    await login.goto();
    await login.submit(agent.email, agent.password);
    await expect(login.loginError).toBeVisible({ timeout: SERVER_TIMEOUT });
    await expect(page).toHaveURL(/\/login/);
  });

  test('18 - Login with the new password succeeds @smoke @manual', async () => {
    await login.goto();
    await login.submit(agent.email, agent.newPassword);
    await waitForManualOtp(page);
    await expect(layout.dashboardHeading('Agent')).toBeVisible();
  });

  test('19 - Self Statement contains the expected transaction data @smoke @manual', async () => {
    await statement.open();
    agentStatement = await statement.extractAll();
    expect(agentStatement.headers).toEqual([
      'Transaction ID', 'Sender Account', 'Receiver Account', 'Type', 'Debit', 'Credit', 'Balance', 'Date',
    ]);
    expect(agentStatement.rows.length).toBeGreaterThanOrEqual(2);

    const fromSystem = SelfStatementPage.findRow(agentStatement, systemDeposit.trnxId);
    expect(fromSystem, 'System deposit missing from Agent statement').toBeTruthy();
    expect(fromSystem!['Sender Account']).toBe('SYSTEM');
    expect(parseAmount(fromSystem!['Credit'])).toBe(AMOUNTS.systemDeposit);

    const toCustomer = SelfStatementPage.findRow(agentStatement, customerDeposit.trnxId);
    expect(toCustomer, 'Customer deposit missing from Agent statement').toBeTruthy();
    expect(parseAmount(toCustomer!['Debit'])).toBe(AMOUNTS.customerDeposit);

    expect(await statement.currentBalance()).toBeCloseTo(expectedBalanceAfterCustomerDeposit, 2);
  });

  test('20 - Self Statement data is saved into the required CSV file @smoke @manual', async () => {
    const fileName = `self_statement_${todayLocal()}.csv`;
    csvPath = writeCsv(path.join('output', fileName), agentStatement.headers, agentStatement.rows);

    expect(fs.existsSync(csvPath)).toBe(true);
    expect(path.basename(csvPath)).toMatch(/^self_statement_\d{4}-\d{2}-\d{2}\.csv$/);
    const saved = readCsv(csvPath);
    expect(saved[0]).toEqual(agentStatement.headers);
    expect(saved.slice(1)).toEqual(agentStatement.rows);
    await test.info().attach(fileName, { path: csvPath, contentType: 'text/csv' });
    console.log(`  CSV saved: ${csvPath}`);
  });
});
