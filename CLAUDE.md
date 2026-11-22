# CLAUDE.md — dMoney Playwright project

Guidance for Claude Code (and other AI agents) working in this repository.

## What this is
Playwright + TypeScript end-to-end automation of the dMoney Portal
(`https://dmoneyportal.roadtocareer.net`, API `https://dmoney.roadtocareer.net`).
The suite automates one Agent journey: register → admin activates → system deposits 2000 →
agent cash-in 500 to a customer → password reset → self statement → CSV export.

## Layout
- `tests/dmoney-agent-journey.spec.ts` — the 20 serial test steps (one shared page/video)
- `pages/` — Page Objects. Locators are **getters** (not class fields) because field
  initializers run before the `page` parameter property is assigned.
- `utils/env.ts` (reads `.env`), `utils/testData.ts` (unique agent data, amounts),
  `utils/csv.ts`, `utils/manualAssist.ts` (pauses for email OTP / reset link)
- `docs/app-map.md` — **read this first**: every page, locator, API call and known quirk
- `output/self_statement_YYYY-MM-DD.csv` — generated statement export
- `videos/` — headed run recording (git-ignored)

## Commands
- `npm run test:regression` — full suite, headed (needs a human for OTP + reset link)
- `npm run test:smoke` — only `@smoke` (positive) tests, headed
- `npm run test:auto` — steps that need no email (`--grep-invert @manual`)
- `npm run report` — open the HTML report

## Rules
- Tags: `@smoke` = positive case, `@negative` = negative case, `@manual` = needs a human
  (email OTP or reset link). Every new test gets exactly one of `@smoke`/`@negative`.
- Keep tests serial; later steps depend on state from earlier ones.
- Never hard-code credentials or personal emails in code. Use `.env` via `utils/env.ts`;
  add new keys to `.env.example`.
- Prefer role/label locators (`getByRole`, `getByLabel`). React ids are unstable.
- Filter `role="alert"` by text — there is always an empty Next.js route-announcer alert.
- The shared server is public and noisy: always use unique emails/phones and search by
  your own data, never by row position.
- Agent cash-in earns 2.5% commission: after 2000 in and 500 out, balance is **1512.5**.
- Agent login always needs a 4-digit email OTP (2 min). Don't try to bypass it; use
  `waitForManualOtp(page)`. Reset uses an emailed link: `waitForManualResetLink(page)`.
- Do not click **Delete** on users the test did not create.
- The backend sometimes hangs for 15–45 s. Waits that depend on a server answer use
  `SERVER_TIMEOUT` (60 s) from `utils/testData.ts`; login and Self Statement retry once.
