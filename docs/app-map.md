# dMoney Portal — App Map

Explored on 2026-11-12 with the Playwright MCP (Chromium). No test code written yet.

| | |
|---|---|
| **Frontend (UI)** | `https://dmoneyportal.roadtocareer.net` (Next.js 15 + MUI) |
| **Backend API** | `https://dmoney.roadtocareer.net` (Express, JSON, CORS `*`) |
| **Auth** | JWT (`expiresIn: 1h`), stored in `localStorage.token` + cookie `token` |
| **Extra header** | Authenticated API calls send `Authorization: Bearer <jwt>` and `X-AUTH-SECRET-KEY: ROADTOSDET` (hard-coded in the frontend bundle) |
| **API docs** | None found (`/api-docs`, `/swagger`, `/docs`, `/swagger.json` all 404) |

> **Sources:** what is marked *observed* was seen in the browser or network log. What is marked *from source* was read from the minified Next.js bundles and not exercised end-to-end (usually because exercising it would create data or send email).

### What I did not touch
- **No user was registered.** I didn't submit sign-up with valid data.
- **No user was changed.** I opened Edit User and the status dropdown, then cancelled. No PATCH was sent.
- **No deposit / cash-in was submitted.**
- **No forgot-password email was requested.**

---

## 0. Landing page — `/`

- Header links: `getByRole('link', { name: 'Sign Up' })` → `/register`, `getByRole('link', { name: 'Login' })` → `/login`
- CTAs: `Get Started Free →`, `Login to Dashboard`, `Create Free Account`, `Already have an account? Login`
- Marketing copy says registration is a "2-step flow with email OTP". **The real `/register` page has no OTP step** (see §1 and the risks section).
- Lists 5 roles: Admin, Agent, Customer, Merchant, System.

---

## 1. Sign Up — `/register`

### Fields (observed)

| Label (accessible name) | Input type | `name` | Placeholder | Notes |
|---|---|---|---|---|
| Full Name * | `text` | `name` | `Enter your full name` | |
| Email Address * | `email` | `email` | `yourname@gmail.com` | Helper text: "Only Gmail addresses (@gmail.com) are accepted" |
| Password * | `password` | `password` | `Minimum 4 characters` | |
| Phone Number * | `text` | `phone_number` | `11-digit phone number (e.g. 01XXXXXXXXX)` | |
| National ID (NID) * | `text` | `nid` | `7–13 digit NID number` | Length is **not** validated in the client |
| Account Type (Role) * | MUI Select (`role="combobox"`, no accessible name) + hidden native input | — | — | Options below |

`id`s are React-generated (`_R_6kkinpfdb_` etc.). They're unstable, so **don't use them**.

**Role options** (MUI listbox, `[role=option]` with `data-value`):

| Text | `data-value` |
|---|---|
| 👤 Customer | `Customer` |
| 🏪 **Agent** | `Agent` ✅ **Agent is available** |
| 🏢 Merchant | `Merchant` |

Choosing a role shows a hint, e.g. **"Agent:** Cash-in to customers, payment to merchants".
Static info text: "After registration, your account will be **pending** approval. An admin will activate your account before you can perform transactions."

**Submit:** `getByRole('button', { name: 'Create Account →' })` (label changes to `Registering…` while the request is in flight).
**Footer:** "Already have an account? Login here" (a styled span, not a link).

### Client-side validation (checked in this order, shown in one MUI `Alert` above the form)

1. Any field empty → `All fields are required.`
2. Email not ending in `@gmail.com` → `Only Gmail addresses (@gmail.com) are allowed for registration.` *(observed)*
3. Phone length ≠ 11 → `Phone number must be exactly 11 digits.` *(observed)*
4. Password < 4 chars → `Password must be at least 4 characters.`

None of these send a network request *(observed)*.

### After submit (observed on 2026-11-12 with a real registration)

- `POST https://dmoney.roadtocareer.net/user/register` → **201 Created**
  Request: `{"name":"Agent Test One","email":"imran.sarker.3006+agenttest1@gmail.com","password":"1234","phone_number":"01558334685","nid":"5583346851","role":"Agent"}`
  Response: `{"message":"Registration successful. Your account is pending approval by an admin.","user":{"id":106498,"name":"Agent Test One","email":"imran.sarker.3006+agenttest1@gmail.com","phone_number":"01558334685","role":"Agent","status":"pending"}}`
- **No OTP at registration** (confirmed). The response has no `otpRequired` and no OTP, and the UI shows no OTP screen.
- **2xx:** green alert with the server message **`Registration successful. Your account is pending approval by an admin.`** (the frontend fallback text `Registration successful! … You can now login.` is not what you see). The form clears and the page **redirects to `/login` after 3 s**.
- Gmail `+alias` addresses are accepted.
- **HTTP 208:** `Account already exists with this email or phone number.` (or the server message)
- **Other error:** server `message`, or `Registration failed. Please try again.`
- **No OTP screen exists in the register page code.** The new user is created with status **PENDING**, and an admin has to set it to **Active** (§3).

### Recommended locators

```ts
page.getByLabel('Full Name')            // or getByPlaceholder('Enter your full name')
page.getByLabel('Email Address')
page.getByLabel('Password')
page.getByLabel('Phone Number')
page.getByLabel('National ID (NID)')
page.getByRole('combobox')              // only combobox on the page; then:
page.getByRole('option', { name: /Agent/ })
page.getByRole('button', { name: 'Create Account →' })
page.getByRole('alert').filter({ hasText: /Registration successful|already exists|Only Gmail/ })
```

> The page also contains an always-present empty `alert` (Next.js route announcer). Filter alerts by text, or use `.MuiAlert-message`.

---

## 2. Login — `/login`

### Fields (observed)

| Label | Type | `name` | Placeholder |
|---|---|---|---|
| Email or Phone Number * | `text` | *(none)* | `Enter email or phone number` |
| Password * | `password` | *(none)* | *(none)* |

- `Forgot password?`: a **`<span>` with an onClick** (not a link/button) that routes to `/forgot-password`.
- Submit: `getByRole('button', { name: 'Login →' })`
- Footer: "Don't have an account? Sign Up Free" (span)
- Badge: "🔒 Secured with JWT + OTP Authentication"

### Network (observed)

`POST https://dmoney.roadtocareer.net/user/login`, body `{"email":"<email or phone>","password":"..."}`. The key is always `email`, even when a phone number is entered.

| Case | Status | Response body | UI message |
|---|---|---|---|
| Wrong password | 401 | `{"message":"Password incorrect"}` | **`Login failed. Please input correct email/phone number or password.`** |
| Empty field(s) | — (no request) | — | `Email/Phone Number and Password cannot be empty.` |
| Network error | — | — | `Network error. Please ensure the backend API is running.` |
| Success (admin, system) | 200 | `{"message":"Login successful","token":"<jwt>","role":"Admin","expiresIn":"1h"}` | redirect |

**On success** the frontend then calls `GET /user/search/email/{email}` (or `/user/search/phonenumber/{phone}`) and stores `token, role, email, name, userId, phoneNumber, photo, balance` in localStorage, sets the cookie `token=<jwt>; max-age=<jwt exp>`, and redirects to **`/profile`**.

### Login OTP step (from source; not hit by admin or system)

If the login response has **no `token` but `otpRequired: true`**, the page switches to an OTP view:
- Title `Verify Your Identity`, subtitle `Enter the OTP sent to your email`, warning alert `OTP sent to your registered email address.` (or the server message)
- Field label `Enter 4-Digit OTP`, placeholder `• • • •`, numeric, max length 4, helper `Check your registered email. Valid for 2 minutes.`
- Client error if not 4 digits: `Please enter the 4-digit OTP.`
- Verify: `POST /user/verify-otp` body `{ "identifier": "<email/phone typed>", "otp": "1234" }` → `{ token }`. On failure: server message or `OTP verification failed. Please try again.`
- **`?env=` hook:** if `/login?env=XYZ` is opened, the verify call becomes `POST /user/verify-otp?env=XYZ`. This looks like a test/back-door switch. The allowed values and their effect are unknown.

The seeded `admin@dmoney.com` and `system@dmoney.com` logged in **without** an OTP.

**A newly registered and activated Agent DOES get the OTP step (observed 2026-11-12, user 106498):**
- `POST /user/login` `{"email":"imran.sarker.3006+agenttest1@gmail.com","password":"1234"}` → **200** `{"message":"OTP sent to your registered email address","otpRequired":true}`. The response has **no token and no OTP** (headers checked too), so nothing leaks.
- UI: heading `Verify Your Identity`, `Enter the OTP sent to your email`, notice `OTP sent to your registered email address`, textbox `Enter 4-Digit OTP` (placeholder `• • • •`), helper `Check your registered email. Valid for 2 minutes.`, buttons **`Verify OTP →`** and **`← Back to Login`**.
- localStorage stays empty until the OTP is verified.
- **Verify (observed):** `POST /user/verify-otp` `{"identifier":"imran.sarker.3006+agenttest1@gmail.com","otp":"5757"}` → **200** `{"message":"Login successful","token":"<jwt>","role":"Agent","expiresIn":"1h"}`. The frontend then does `GET /user/search/email/{email}`, fills localStorage (`role=Agent`, `phoneNumber=01558334685`) and redirects to `/profile` (Agent Dashboard).
- The OTP came from the user's Gmail inbox (alias `+agenttest1` delivers to the main inbox).
- **The OTP is required on EVERY login for this agent, not just the first** (second login at 07:23 UTC again returned `otpRequired: true`). An already-verified account doesn't skip it.

### Recommended locators

```ts
page.getByLabel('Email or Phone Number')     // or getByPlaceholder('Enter email or phone number')
page.getByLabel('Password')
page.getByRole('button', { name: 'Login →' })
page.getByText('Forgot password?')
page.getByText('Login failed. Please input correct email/phone number or password.')
// OTP view
page.getByLabel('Enter 4-Digit OTP')         // or getByPlaceholder('• • • •')
```

---

## 3. Admin — `admin@dmoney.com / 1234`

Lands on **`/profile`**. Header: `Admin Dashboard`, a `Balance` button, avatar block (`A` / `Admin` / `Admin`).

### Sidebar (`navigation`)

| Link | URL |
|---|---|
| User List | `/admin/users` |
| Create User | `/admin/users/create` |
| Deposit (SYSTEM) | `/admin/deposit` |
| Transaction List | `/admin/transactions` |
| My Profile | `/profile` |

(`Create User`, `Deposit (SYSTEM)` and `Transaction List` were not opened.)

### Profile `/profile`
Read-only fields (disabled textboxes): Full Name, Email Address, Phone Number, National ID (NID), Role, Current Balance (BDT), Registered On. Also an "Account Status" chip (`ACTIVE`), an `Edit Profile` button and `Upload photo (JPG / PNG, max 1 MB)`.

### User List `/admin/users` (observed)

- Heading `User List`, sub-heading `Total: 2745`
- API: `GET /user/list?count=10&page=1&order=desc` (newest first)
- Table columns: **ID | Name | Email | Phone | Balance (BDT) | Role | Status | Registered Date | Action**
- **Status** is a coloured MUI Chip in the Status cell. Values seen: **`PENDING`** (orange, `MuiChip-colorWarning`) and **`ACTIVE`**. The edit dropdown also offers **`Suspended`**. **There is no "Inactive" status:** *pending* = not yet activated.
- Action buttons per row: `View`, `Delete` ⚠️ (don't click Delete in tests unless the user was created by the test)
- Pagination: MUI `navigation "pagination navigation"` (buttons `Go to next page`, `page 1`…), "Rows per page" select (default 10)

### Search / filter (observed)

`Search Type` select (combobox) → options:

| Text | value |
|---|---|
| All Users | `""` |
| Search by ID | `id` |
| Search by Phone Number | `phone` |
| Search by Email | `email` |
| Search by Role | `role` |

After you pick a type, a textbox appears (for email: label `Enter Email`, placeholder `e.g., user@example.com`) with `Search` and `Reset` buttons.
Search by email calls `GET /user/search/email/{urlencoded}` and shows a single row; the heading becomes `Total: 1`.

### Activate a user (done for real on 2026-11-12, user 106498)

Observed: the new user showed `PENDING` in the list. After Save Changes: `PATCH /user/update/106498` → **200**
request `{"name":"Agent Test One","email":"imran.sarker.3006+agenttest1@gmail.com","phone_number":"01558334685","nid":"5583346851","role":"Agent","status":"active"}`
response `{"message":"User updated successfully","user":{…,"status":"active"}}`. The alert shows `User updated successfully`. **After a full page reload the status chip still shows `ACTIVE`** and the select shows `Active`. The status value is lowercase in the API (`pending`/`active`/`suspended`) and uppercase in the chips.

Normal Playwright clicks worked for every step: `View` in the row, `Edit User`, the status combobox, the `Active` option and `Save Changes`. Locator for the status select while editing: `getByRole('combobox').filter({ hasText: 'Pending' })`.

Steps:

1. User List → search → row `View` → **`/admin/users/{id}`** (calls `GET /user/search/id/{id}`)
2. The page shows an `Account Status` chip (`PENDING`) plus disabled fields: User ID, Full Name, Email Address, Phone Number, National ID (NID), Role (select), **Account Status (select)**, Current Balance, Registered On.
3. Click **`Edit User`**. The fields become editable, and the buttons become `Cancel` / `Save Changes`.
4. Open the **Account Status** combobox → options `Pending` (`pending`), **`Active` (`active`)**, `Suspended` (`suspended`).
5. **Save Changes** → `PATCH /user/update/{id}` body `{ name, email, phone_number, nid, role, status }` → snackbar `User updated successfully` (error: server message or `Failed to update user`).

### Logout (observed)

Click the avatar block in the header to open a MUI Menu with `👤 Profile`, `🔑 Change Password` (`/change-password`), `🚪 Logout`.
Logout is **only in the browser**: `localStorage.clear()`, the token cookie is expired, and the page goes to `/login`. **No API call is made**, so the JWT stays valid on the server until it expires. The layout also checks token expiry every 30 s and logs out when it has expired.

### Recommended locators

```ts
page.getByRole('link', { name: 'User List' })
page.getByRole('heading', { name: 'User List' })
page.getByRole('combobox').first()                         // Search Type (before a search type is chosen it's the only one above the table)
page.getByRole('option', { name: 'Search by Email' })
page.getByLabel('Enter Email')                              // or getByPlaceholder('e.g., user@example.com')
page.getByRole('button', { name: 'Search' })
const row = page.getByRole('row').filter({ hasText: email })
row.getByRole('cell', { name: 'PENDING' })                  // status
row.getByRole('button', { name: 'View' })
// user detail
page.getByRole('button', { name: 'Edit User' })
page.getByRole('combobox').filter({ hasText: 'Pending' })   // Account Status select (Role select shows the role text)
page.getByRole('option', { name: 'Active' })
page.getByRole('button', { name: 'Save Changes' })
page.getByText('User updated successfully')
// logout
page.locator('header').getByText('Admin', { exact: true }).first()  // opens menu; see the click-reliability risk below
page.getByRole('menuitem', { name: /Logout/ })
```

---

## 4. System — `system@dmoney.com / 1234`

**Important:** the System account logs in with **role `Agent`**. localStorage `role = "Agent"` and `phoneNumber = "SYSTEM"`. It gets the **Agent Dashboard**, so its "deposit" page is **Cash In**.

Header: `Agent Dashboard`, `Balance` button, avatar `A` / `SYSTEM` / `Agent`.

### Sidebar

| Link | URL |
|---|---|
| Cash In | `/agent/cash-in` |
| Payment | `/agent/payment` |
| Self Statement | `/agent/self-statement` |
| My Profile | `/profile` |

### Cash In (deposit) — `/agent/cash-in` (fields observed, submit from source)

Title `Cash In`, subtitle `Deposit funds into a customer's wallet`.

| Label | Type | `name` | Placeholder |
|---|---|---|---|
| Customer Phone Number * | `text` | `customer` | `Enter customer's phone number` |
| Amount (BDT) * | `number` (role `spinbutton`) | `amount` | `Enter amount in BDT` |

The receiver is identified **by phone number only** (no email option).
Submit: `getByRole('button', { name: 'Cash In →' })`

Client validation (field helper text):
- `Customer phone number is required.`
- `Amount is required.` (empty or `0`)
- `Amount must be greater than 0.`

Request: `POST /transaction/deposit` body `{ "from_account": localStorage.phoneNumber (e.g. "SYSTEM" or the agent's phone), "to_account": "<customer phone>", "amount": <number> }`

- **Success:** `response.message`, or the fallback **`Cash in successful!`**. The UI also shows `trnxId`, the deposited amount and `currentBalance`.
- **HTTP 208:** server message, or `Transaction could not be completed.` (business rule refusal, e.g. limit or inactive account)
- **Error:** server message, or `Failed to process cash in`

### Where transactions are listed — Self Statement `/agent/self-statement` (observed)

- Heading `Transaction History (Total: 27541)`, sub-heading **`Current Balance: BDT 4981338380.05`**
- Filters: `From Date`, `To Date` (native `<input type="date">`, both **default to today**), `RESET TO TODAY` button
- Summary text: `Showing 0 of 27541 total transaction(s) from 2026-11-12 to 2026-11-12`
- Table columns: **Transaction ID | Sender Account | Receiver Account | Type | Debit | Credit | Balance | Date**
- Empty state: `No transactions found for the selected date range.`
- Pagination: `1–20 of 27541`, `Go to previous page` / `Go to next page`
- API: `GET /transaction/statement/{phoneNumber}?page=1&count=20` → `{ message, total, count, transactions: [...] }`, newest first.
  Item: `{ id, account, from_account, to_account, description: "System Deposit to Agent", trnxId: "TXN62CAROKXQC", debit, credit, transaction_type: "Deposit", createdAt, updatedAt }`
- The date filter appears to run **client-side on the 20 loaded rows**: the total stays 27541 while 0 are shown for today.

Logged out via avatar menu → `Logout` (same mechanism as admin).

---

## 5. Forgot / Reset Password

### Start: Login → `Forgot password?` → **`/forgot-password`** (observed)

- Title `Forgot Password?`, text `Enter your registered email or phone number and we'll send you a reset link.`
- Field: **Email or Phone Number *** (`text`, placeholder `e.g. user@gmail.com or 01xxxxxxxxx`), helper `We'll send the reset link to your registered Gmail address.`
- Button: `Send Reset Link →`. Links: `← Back to Login`, "Remember your password? Sign In"
- **Observed 2026-11-12:** `getByText('Forgot password?', { exact: true })` on `/login` → `/forgot-password`. Entering `imran.sarker.3006+agenttest1@gmail.com` → `POST /user/forgot-password` `{"email":"imran.sarker.3006+agenttest1@gmail.com"}` → **200** `{"message":"Password reset link has been sent to your registered email address."}`. **No token in the response.** The UI shows the frontend's own success text (below), not the server message.
- Request (from source): `POST /user/forgot-password` body `{ "email": ... }` if the value contains `@`, otherwise `{ "phone_number": ... }`
  - Success: `A password reset link has been sent to your registered Gmail address. Please check your inbox.`
  - 404: `Please input registered phone number or email.`
  - Empty: `Please enter your registered email or phone number.`
  - Other: server message or `Something went wrong. Please try again.`

### Reset: **`/reset-password?token=<token>`** (from email link)

- No token → `Invalid reset link. Please request a new password reset.` + `Need a new link? Request again` *(observed)*
- With token: fields **New Password *** (helper `Minimum 4 characters.`), **Confirm New Password ***, button `Reset Password →`. Footer: "🔒 Secure password reset — link valid for 1 hour" *(observed with a dummy token)*
- Client validation: `Both password fields are required.`, `Password must be at least 4 characters long.`, `Passwords do not match.`
- **Observed with a real emailed link (2026-11-12, user 106498):**
  - Link format: `https://dmoneyportal.roadtocareer.net/reset-password?token=<64 hex chars>` (a 32-byte random token, not a JWT).
  - **The token isn't checked when the page loads.** No API call is made, and the form renders the same as with `token=dummy`. A bad or expired token only shows up after submitting.
  - Client validation confirmed (no network request for any of these):
    - empty → `Both password fields are required.`
    - `12`/`12` → `Password must be at least 4 characters long.`
    - `12345`/`54321` → `Passwords do not match.`
  - Both inputs are `type="password"` with no `name`. Locators: `getByRole('textbox', { name: 'New Password', exact: true })` (exact is needed because "Confirm New Password" also contains "New Password") and `getByLabel('Confirm New Password')`. Button: `getByRole('button', { name: 'Reset Password →' })`.
  - **Success path (observed):** `1234`/`1234` → `POST /user/reset-password` `{token, password:"1234", confirmPassword:"1234"}` → **200** `{"message":"Password has been reset successfully. Please login with your new password."}`. UI: `Your password has been reset successfully. Redirecting to login…`, then `/login` about 2.5 s later.
  - **The token is single-use (observed):** resubmitting the same token → **400** `{"message":"Invalid or expired password reset link. Please request a new one."}`. The UI shows that server message in the error alert.
  - Logging in with the new password (`1234`) → 200 `otpRequired: true`, so the password was accepted. The agent's password is still `1234`.
  - ⚠️ **The reset token leaks to Google Analytics:** the GA4 `page_view` and `scroll` events send the full page URL (`dl=…/reset-password?token=…`) to `google-analytics.com`.
- Request: `POST /user/reset-password` body `{ token, password, confirmPassword }`
  - Success: `Your password has been reset successfully. Redirecting to login…`, then `/login` after 2.5 s
  - Error: server message or `Invalid or expired reset link. Please request a new one.`

**OTP? No.** Password reset uses an **emailed link with a token**, not an OTP. You can't complete it without reading the Gmail inbox or getting the token another way.

There is also a logged-in **Change Password** page at `/change-password` (avatar menu). It wasn't explored.

---

## 6. Agent role

Seen as the System user, whose role is Agent. A real registered Agent should see the same layout.

| Feature | Where |
|---|---|
| **Deposit to customer** | Sidebar **Cash In** → `/agent/cash-in` (§4). `from_account` = the agent's own phone number. |
| **Balance** | (a) Header **`Balance`** button. From source it calls `GET /transaction/balance/{phoneNumber}` and toggles a balance display. (b) `Current Balance: BDT …` heading on Self Statement. (c) `Current Balance (BDT)` field on `/profile` (taken from the user record). |
| **Self Statement** | Sidebar **Self Statement** → `/agent/self-statement` |
| Payment (to merchant) | Sidebar **Payment** → `/agent/payment` (not explored) |

**Self Statement columns:** `Transaction ID`, `Sender Account`, `Receiver Account`, `Type`, `Debit`, `Credit`, `Balance`, `Date`.

```ts
page.getByRole('link', { name: 'Cash In' })
page.getByLabel('Customer Phone Number')
page.getByRole('spinbutton', { name: 'Amount (BDT)' })      // or getByLabel('Amount (BDT)')
page.getByRole('button', { name: 'Cash In →' })
page.getByText(/Cash in successful/i)
page.getByRole('link', { name: 'Self Statement' })
page.getByRole('heading', { name: /Current Balance: BDT/ })
page.getByLabel('From Date'); page.getByLabel('To Date')
page.getByRole('button', { name: 'Reset to today' })        // text is uppercased by CSS only
page.getByRole('columnheader', { name: 'Transaction ID' })
page.getByRole('button', { name: 'Balance' })
```

---

## API endpoint summary

| Method | Endpoint | Used by | Auth |
|---|---|---|---|
| POST | `/user/register` | Sign Up | none |
| POST | `/user/login` | Login | none |
| POST | `/user/verify-otp[?env=]` | Login OTP step | none |
| POST | `/user/forgot-password` | Forgot password | none |
| POST | `/user/reset-password` | Reset password | token in body |
| GET | `/user/search/email/{email}` · `/phonenumber/{p}` · `/id/{id}` | profile, admin search/detail | Bearer + secret key |
| GET | `/user/list?count=&page=&order=desc` | Admin User List | Bearer + secret key |
| PATCH | `/user/update/{id}` | Admin edit user / activate; own profile | Bearer + secret key |
| POST | `/transaction/deposit` | Agent Cash In | Bearer + secret key |
| GET | `/transaction/statement/{phone}?page=&count=` | Self Statement | Bearer + secret key |
| GET | `/transaction/balance/{phone}` | Header Balance button | Bearer + secret key |

---

## Risks & Open Questions

### OTP / email-dependent flows (highest risk)

1. **RESOLVED: sign-up has no OTP** (real registration: 201, status `pending`, no OTP; the OTP happens at first login instead, see 2). Original note: **docs and code disagree.** The landing page says "An OTP will be sent to verify your email. Complete the 2-step registration flow", but the `/register` code is a single POST with no OTP screen. It then goes to `/login` and the account is **PENDING** until an admin activates it.
   - *Open:* does `/user/register` send an OTP email anyway, or return `otpRequired`? I didn't submit a real registration, so the response body wasn't observed. **First action when writing tests:** run one registration with a throwaway `@gmail.com` and capture the request and response.
2. **CONFIRMED: login OTP blocks newly registered users.** The new Agent (106498) got `otpRequired: true` with a 4-digit OTP that is valid for 2 minutes and sent **only by email**. The OTP is not in the response. Seeded admin/system accounts skip it. **It happens on every login, not only the first**, so reusing a pre-verified agent doesn't avoid it. The only way to reuse a login is to save the storage state (JWT, valid 1 h). Automated agent login therefore needs one of:
   - **(a) The `?env=` hook.** `/login?env=<value>` is forwarded to `/user/verify-otp?env=<value>`, which probably enables a fixed/test OTP or bypass. **Ask the course or platform owner for the valid value and the OTP it accepts.**
   - **(b) A Gmail API / IMAP reader** for a test inbox. `+alias` addresses are accepted (others use `skfamily0304+NNN@gmail.com`).
   - **(c) Logging in via the API** and injecting `localStorage` and the cookie (storageState). This only works if the API also skips the OTP.
   - The OTP was **not seen in any response body** in what I observed. Admin/system logins returned the token directly. Whether `/user/login` leaks the OTP for an OTP-required user is unverified.
3. **Password reset is email-link based (token), not OTP** (confirmed: the forgot-password response has no token; the link is in the email. Link format confirmed: `/reset-password?token=<64-hex>`; the page says it's valid for 1 hour (not verified). The token is single-use (a second submit returns 400). Tests can cover the UI validation and the invalid-token error with any token. The real success path needs a fresh token from the email for each run. If a test-mode hook exists for this, it's unknown.)
20. **Security: password-reset token sent to Google Analytics** in the page URL (`dl` param), and the token isn't validated until submit. Worth a bug report. The token only exists in the email, so a full E2E reset test needs Gmail access or a test-mode hook. The UI parts that can be tested without the email: the forgot-password success/404 messages and the reset page's validation with a dummy token.

### Data & environment

4. **Shared, public, noisy environment.** There are 2,745+ users and 27k+ SYSTEM transactions, and other students run tests at the same time. Use unique emails/phones per run (11 digits, starting `01`) and search by your own email. Never rely on row position.
5. **Every sign-up and activation leaves real data** on a shared server. There's no cleanup API apart from admin `Delete` in the UI. Decide whether tests should delete the users they create.
6. **Phone uniqueness / HTTP 208**: duplicate email or phone returns 208 "Account already exists…". Generate values that won't collide.
7. **Seeded credentials could change** (`admin@dmoney.com` / `system@dmoney.com` with password `1234`). If another user resets them, everything breaks. Keep credentials in env vars or `.env`, not hard-coded.
8. **The System account is an Agent with `phoneNumber = "SYSTEM"`.** Cash In from System sends `from_account: "SYSTEM"`. To test "System deposits to Agent" through the UI, log in as system and Cash In to the agent's phone. Confirm that this is the intended flow (the Admin "Deposit (SYSTEM)" page at `/admin/deposit` is a different flow I didn't explore).
9. **Pending agents can't transact.** Expect a 208 "Transaction could not be completed" until the admin sets them to Active. Order your tests: register → admin activates → deposit → agent checks balance/statement.
10. **Transaction limits and balance caps** are mentioned in the platform marketing. Big or repeated deposits might return 208. Use small amounts.

### UI / automation quirks

11. **Click reliability, retested 2026-11-12 (Admin session):** a normal Playwright click worked for **all** of these: the `Balance` button (it called `GET /transaction/balance/01686606909` and the button label became `৳ -121111683792.00`), the avatar block (`getByText('AAdminAdmin')`) to open the menu, and `getByRole('menuitem', { name: /Logout/ })`, which cleared localStorage and went to `/login`. **Agent-layout retest (new agent 106498, after OTP login): normal Playwright clicks also worked for everything.**
    - `getByRole('button', { name: 'Balance' })` → `GET /transaction/balance/01558334685` → the button's accessible name **changes to `৳ 0.00`**. Clicking it again (`getByRole('button', { name: /৳/ })`) **toggles back to `Balance`** without a request. So in tests, assert the `৳` button after one click, and don't click twice.
    - Avatar block `getByText('AAgentAgent')` (the container with the onClick; its text is avatar initial + name + role) → menu opens → `getByRole('menuitem', { name: /Logout/ })` → `/login`, with localStorage and cookie cleared.
    - **No fallback was needed** (no DOM click, no `force`, no keyboard).
    - **Likely cause of the earlier failures:** in the System session I had reached the pages with direct `page.goto` and clicked several times in a row. Balance and the menu are toggles, so repeated clicks undo each other, and some clicks landed on the menu's invisible MUI backdrop. Recommended pattern: click once, then wait for the expected result (`৳` button / `menuitem` visible) before the next action. Keep `page.evaluate(() => { localStorage.clear(); document.cookie='token=; path=/; max-age=0' })` + `goto('/login')` as a last-resort logout helper.
    **Earlier (System/Agent session; kept for history):** Playwright pointer clicks on the avatar block and on `Logout` didn't trigger the React handler for the System/Agent session (the menu didn't open, or Logout didn't run), while DOM `.click()` worked. The same flow worked first time for Admin. Possible causes: an MUI invisible backdrop, or the click landing on a non-handler child. In tests, click the element that actually has the handler (the avatar container), assert `getByRole('menuitem', { name: /Logout/ })` is visible before clicking, and retry if needed. As a fallback for logout, clear storage and go to `/login`.
12. **Balance button: works for Admin and the new Agent (see 11). Not re-checked for the System account.** It sent no `/transaction/balance` request when clicked as System earlier (same click issue, or the call doesn't fire for `SYSTEM`). For balance assertions, prefer the Self Statement `Current Balance: BDT …` heading or the API.
13. **Self Statement shows today's rows only from the 20 loaded.** The date filter defaults to today and seems to filter client-side. A new transaction appears if it's on page 1 and the browser's local date matches the date the server stored (`createdAt` is UTC, while the CI runner may be UTC and the user is in Asia/Dhaka, UTC+6).
14. **Many controls lack accessible roles.** `Forgot password?`, `Sign Up Free` and `Login here` are `<span>`s with onClick (use `getByText`). The role select on Register and the Search Type select have no accessible name (use `getByRole('combobox')` scoped or by position).
15. **There's always an empty `role="alert"`** (Next.js route announcer). Filter alert assertions by text.
16. **The login error message hides the server reason.** The UI always says "Login failed…" for 401/400, while the API says "Password incorrect". Assert on the UI text.
17. **Logout doesn't revoke the JWT on the server.** It stays usable for up to 1 h (possible security finding). Tokens can also expire mid-suite after 1 h.
18. **The NID length (7–13) is only in the placeholder.** It isn't checked in the client, so the server's behaviour for invalid NIDs is unknown.
19. **Secret header `X-AUTH-SECRET-KEY: ROADTOSDET` is shipped in the frontend bundle.** Useful for API-level setup and helpers, and worth noting as a security observation.

### Not explored (follow-ups)
- Admin: `Create User`, `Deposit (SYSTEM)` (`/admin/deposit`), `Transaction List` (`/admin/transactions`)
- Agent: `Payment` page, header Balance display contents
- Customer and Merchant dashboards
- `/change-password`
