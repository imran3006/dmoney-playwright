---
description: Run only the positive (@smoke) dMoney tests, headed
---

Run the smoke suite (positive test cases only):

```
npm run test:smoke
```

It still needs the user for the OTP (twice) and the reset link (once). Report the result
per test number, explain any failure from `test-results/**/error-context.md`, and remind
the user to screenshot the output for the "SmokeTest Result" section of README.md.
