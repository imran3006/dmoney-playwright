---
description: Diagnose the latest failing Playwright test
argument-hint: [test number or name]
---

Diagnose the failing test $ARGUMENTS:

1. Find the newest folder under `test-results/` for that test and read `error-context.md`
   (it has the error, the page's accessibility snapshot and the source line).
2. Compare the snapshot with the locator used in `pages/` and with `docs/app-map.md`.
3. Decide whether it's a locator change, a timing issue, test data (e.g. customer no longer
   active, duplicate phone) or a real app bug. Say which, with evidence.
4. Propose the smallest fix. Apply it only if the user agrees, then verify with
   `npm run test:auto` (or ask the user to rerun if the test is tagged `@manual`).
