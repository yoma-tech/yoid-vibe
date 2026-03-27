# YoID Dev Docs — Gap Log

> Gaps found while building the yoid-vibe demonstrator against `yoid-docs/` as the sole technical reference.
> Each gap = a documentation issue to fix before real partners hit it.

---

### GAP-001: Docs show deprecated `type` field for template creation — should use `code`

- **Where in docs:** `yoid-docs/issuers/create-credential-template.mdx`
- **What's missing/unclear:** The docs show `type` in the request example, but the real API returns a deprecation warning: `"Field 'type' is deprecated for SD-JWT templates. Use 'code' instead."` The `code` field is never mentioned in the docs. Devs following the docs will use a deprecated field silently.
- **Fix needed:** Update request example to use `code`. Add a note that `type` is deprecated.
- **Validated:** [x] Confirmed via Postman — API returns deprecation warning when `type` is used.

---

### GAP-002: Credential issuance endpoint path

- **Where in docs:** `yoid-docs/issuers/issue-credential.mdx`
- **What's missing/unclear:** The docs specify `POST /credentials/issuance` but without a worked example of the full URL, it was initially implemented as `POST /credentials`. This caused a 404.
- **Assumption made:** Path was initially guessed as `/credentials`.
- **Validated:** [!] Incorrect — correct path is `/credentials/issuance`. Confirmed once docs were read properly.

---

### GAP-003: Revocation uses inner `credentials[0].id` — docs say outer issuance `id`

- **Where in docs:** `yoid-docs/credential-revocation.mdx`
- **What's missing/unclear:** The docs say "Replace the ID with the issuance `id`" — implying the outer issuance ID. But `POST /credentials/{id}/revoke` actually requires `credentials[0].id` (the inner credential record ID). Using the outer issuance ID returns `400: "Issued Credential with id X not found"` even though `GET /credentials/{id}` returns it successfully.
- **Assumption made:** Followed the docs and passed the outer issuance `id`. Got 400 errors.
- **Validated:** [x] Confirmed via Postman — `POST /credentials/{credentials[0].id}/revoke` returns `204`. Using the outer issuance `id` returns `400`.

---

### GAP-004: ~~`createUserAccount` response has no `data` wrapper~~ — CLOSED

- **Validated:** [x] Response confirmed to be `{ data: { email, tempPassword } }`. The `data` wrapper IS present. Gap was based on incorrect earlier observation.

---

### GAP-005: Duplicate account creation returns 201 with empty `tempPassword` — not documented

- **Where in docs:** `yoid-docs/issuers/create-user-account.mdx`
- **What's missing/unclear:** When onboarding a user that already exists, the API returns `201` with `tempPassword: ""` rather than an error. This is a silent success — a dev has no way to know the account already existed unless they check for the empty password. The docs show no mention of this behaviour.
- **Assumption made:** Initially assumed duplicate would error (400 or 409).
- **Validated:** [x] Confirmed via Postman — duplicate returns `{ "data": { "email": "...", "tempPassword": "" } }` with HTTP 201.
- **Fix needed:** Add a note: "If the account already exists, the API returns `201` with `tempPassword` as an empty string. Check for this to avoid re-sending onboarding emails to existing users."

---

### GAP-006: Send credential to wallet — endpoint base URL

- **Where in docs:** `yoid-docs/issuers/send-credential-offer.mdx`
- **What's missing/unclear:** The send-credential-offer endpoint lives on Me Wallet API, not Me Creds API. The three base URLs are documented in the introduction, but are not referenced at each endpoint page. Easy to miss when reading section by section.
- **Assumption made:** Had to cross-reference multiple doc files to determine the correct base URL.
- **Validated:** [x] Confirmed — `WALLET_API_URL` (`/me-wallet/api`) is separate from `API_URL` (`/me-creds/api`). Base URL table exists in the introduction. Not a critical gap — more a UX/navigation issue.

---

### GAP-007: Send credential to wallet — 201 response with no body

- **Where in docs:** `yoid-docs/issuers/send-credential-offer.mdx`
- **What's missing/unclear:** The docs do not explicitly state that a successful send returns 201 with an empty body. Our API wrapper initially tried to parse JSON from the response, which would throw on an empty body.
- **Assumption made:** Initially assumed a JSON response body (consistent with other endpoints).
- **Validated:** [!] Incorrect — response body is empty. Added empty-body handling (`if (res.status === 204) return null` and `if (!text) return null`).

---

### GAP-009: Webhook endpoint security not documented

- **Where in docs:** `yoid-docs/` (absent)
- **What's missing/unclear:** The docs describe webhook registration and event types but say nothing about how to verify that incoming webhook requests originate from YoID. There is no mention of a signing secret, HMAC signature header, or any authentication mechanism. Without this, any attacker who discovers the webhook URL can POST fake events (forged credential verifications, etc.).
- **Fix needed:** Document whether YoID signs webhook payloads (e.g., an `X-Webhook-Signature` header) and provide a verification code example. If the platform doesn't sign webhooks, that should be called out explicitly as a security limitation.
- **Validated:** [x] Confirmed — no signature headers observed in received webhook events. No mention of secrets in the docs.

---

### GAP-008: Youth wallet endpoints not documented

- **Where in docs:** `yoid-docs/` (absent)
- **What's missing/unclear:** There are no docs for endpoints a youth uses to: list their credentials, view pending offers, accept/reject credentials, or respond to presentation requests. The Youth Wallet surface described in `architecture.md` cannot be built from the current docs.
- **Assumption made:** Not yet attempted — flagged as a major gap.
- **Validated:** [ ] Not yet — this blocks Phase 2 (Youth Wallet) entirely.
