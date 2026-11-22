---
description: Run the full dMoney regression suite (headed) and summarise the result
---

Run the full regression suite headed:

```
npm run test:regression
```

Before starting, remind the user that they must be at the keyboard: the run pauses twice
for the 4-digit login OTP (Gmail, 2 minutes) and once for the password-reset link
(paste it into the Playwright browser's address bar, 3 minutes). The prompts appear in
the terminal.

Afterwards:
1. Report passed / failed / skipped per test number (01–20).
2. For any failure, read `test-results/**/error-context.md` and explain the cause.
3. Confirm `output/self_statement_<today>.csv` exists and show its first rows.
4. Tell the user where the video is (`videos/`) and to run `npm run report` for the
   screenshot of the "Regression Test Result".
