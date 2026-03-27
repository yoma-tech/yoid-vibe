# YoID Demonstrator — Architecture & Build Plan

## Purpose

A working demonstrator that proves the YoID credential lifecycle across four distinct surfaces, connected by a single identity protocol. The demo should let a stakeholder walk through: **Partner issues → Youth holds → Employer verifies → Admin measures**.

This is not a production system. It's a demonstrator that makes the ecosystem story tangible — showing what the connected credential lifecycle looks like when it works.

### The hidden goal

This build is also an **integration test of the YoID dev docs**. Claude Code will build the entire demonstrator using only those docs as its technical reference. Every failure, ambiguity, or missing detail becomes a documentation bug surfaced before a real partner hits it.

**Rule: The agent must not reference any source other than the YoID dev docs for API endpoints, request/response shapes, and integration patterns.** If the docs don't answer a question, that's a gap to log — not a reason to go find the answer elsewhere.

---

## Architecture Principles

1. **Four apps, one protocol.** Each actor gets their own surface with its own layout, navigation, and design language. They connect only through the shared API layer. This is the product thesis made visible.

2. **Real API, no mocks.** All four surfaces talk to the live test environment through a thin backend proxy. The proxy exists only to hold OAuth credentials server-side — it adds nothing, transforms nothing, invents nothing. If the docs say the endpoint returns X, the UI expects X.

3. **YoID dev docs are the sole technical reference.** The agent builds against the documented endpoints and contracts. Gaps in the docs are logged as issues, not worked around silently.

4. **Credential lifecycle is the demo script.** Every feature exists to serve one question: can a credential flow from issuance to verification across independent systems?

5. **Current state only.** No AI matching, no pathway builder, no SAP integration, no WhatsApp wallet. These are future capabilities. The demonstrator shows what's real: REST API, credential issuance, wallet storage, presentation requests, verification, and aggregated metrics.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SURFACES (React Apps)                     │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │   Partner     │ │    Youth     │ │   Employer   │            │
│  │   Portal      │ │    Wallet    │ │   Portal     │            │
│  │              │ │              │ │              │            │
│  │ • Onboard    │ │ • View creds │ │ • Search     │            │
│  │ • Template   │ │ • Accept     │ │ • Notify     │            │
│  │ • Issue      │ │ • Present    │ │ • Verify     │            │
│  │ • M&E view   │ │              │ │              │            │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘            │
│         │                │                │                     │
│  ┌──────────────────────────────────────────────────┐          │
│  │              Admin Dashboard                      │          │
│  │  • Ecosystem metrics  • Partner activity          │          │
│  │  • Credential volume  • Youth activation          │          │
│  └──────────────────────┬───────────────────────────┘          │
│                         │                                       │
├─────────────────────────┼───────────────────────────────────────┤
│                         │                                       │
│              ┌──────────▼──────────┐                            │
│              │   Backend Proxy      │                            │
│              │                      │                            │
│              │ • Holds OAuth creds  │                            │
│              │ • Passes through to  │                            │
│              │   real test API      │                            │
│              │ • Adds NOTHING       │                            │
│              │ • App-layer routes   │                            │
│              │   for aggregation    │                            │
│              └──────────┬──────────┘                            │
│                         │                                       │
│              ┌──────────▼──────────┐                            │
│              │  YoID Test API       │                            │
│              │  (real environment)  │                            │
│              └─────────────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why this shape

- **Separate surfaces** = the demo can show a credential flowing *across* independent apps. YoID is infrastructure, not a monolith.
- **Backend proxy** = browser apps cannot safely hold OAuth client secrets. The proxy is a pass-through: it authenticates with the real API server-side and forwards responses unchanged. It is NOT a mock. If the real API returns an error, the frontend gets that error.
- **App-layer routes** = the proxy also hosts a small set of application-layer endpoints (talent search, aggregated metrics) that don't exist in the core credential API. These are clearly separated and labelled as app-layer concerns.
- **No local data store for credentials.** Credentials, users, wallets, presentations — all live in the real test environment. The only local state is UI state (which app you're logged into, filter selections, etc.) and cached API responses.

### What the proxy does

```
Frontend request:
  POST /api/proxy/consumer-onboarding/api/users
  Body: { email, firstName, lastName }

Proxy:
  1. Reads YOID_CLIENT_ID + YOID_CLIENT_SECRET from env
  2. Exchanges for access_token (OAuth client credentials flow)
  3. Forwards request to real API with Bearer token
  4. Returns response unchanged to frontend

Frontend receives:
  { email, tempPassword }   ← straight from real API
```

The proxy adds CORS headers and holds secrets. That's it.

### What the proxy does NOT do

- Does not transform request or response shapes
- Does not cache credentials or user data
- Does not validate beyond what the real API validates
- Does not fall back to mock data if the real API is down

If the API is down, the demo is down. That's honest.

---

## YoID Dev Docs as Source of Truth

### Where the docs live

The YoID dev docs live in a separate private repository. The doc URLs are publicly readable even though the repo itself is private. The user will provide raw URLs (e.g. `raw.githubusercontent.com/...`) at the start of each Claude Code session.

**The agent must `fetch` these URLs to read the docs before implementing any API integration.** Do not guess at endpoints, request shapes, or response formats — read the docs first.

### How the agent should work

When Claude Code needs to make an API call, it must:

1. Fetch the relevant YoID dev doc URL provided by the user
2. Find the relevant endpoint documentation
3. Implement exactly what the docs say — endpoint path, method, headers, request body, expected response
4. If the docs are ambiguous or missing information, **log the gap** in `docs/dev-docs-gaps.md` and make a reasonable assumption (documented)
5. When real credentials are added and the API is hit, verify that assumptions were correct

### Gap logging format

```markdown
## YoID Dev Docs — Gap Log

### GAP-001: [Short description]
- **Where in docs:** [Section/page reference]
- **What's missing/unclear:** [Description]
- **Assumption made:** [What the agent assumed]
- **Validated:** [ ] Not yet / [x] Confirmed / [!] Incorrect — actual behaviour: ...
```

This gap log is a primary deliverable. It feeds directly back into doc improvements.

---

## Repository Structure

```
yoid-demo/
├── README.md
├── ARCHITECTURE.md               ← this file
├── package.json                  ← monorepo root (npm workspaces)
├── .env.example                  ← template for API credentials
│
├── docs/
│   ├── dev-docs-gaps.md              ← gaps found during build (primary deliverable)
│   ├── dev-docs-urls.md              ← list of YoID dev doc URLs for agent reference
│   └── demo-script.md               ← step-by-step walkthrough
│
├── packages/
│   ├── proxy/                    ← Backend proxy server
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── auth.ts           ← OAuth token management
│   │   │   ├── proxy.ts          ← Pass-through to real API
│   │   │   ├── app-routes/       ← App-layer endpoints (not proxy)
│   │   │   │   ├── aggregator.ts ← Metrics aggregation
│   │   │   │   ├── talent.ts     ← Anonymised search
│   │   │   │   └── notify.ts     ← Opportunity notifications
│   │   │   └── middleware/
│   │   │       └── cors.ts
│   │   └── tsconfig.json
│   │
│   ├── shared/                   ← Shared types + API client
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── types.ts          ← TypeScript types (derived from YoID dev docs)
│   │   │   ├── api-client.ts     ← Typed fetch wrapper → proxy
│   │   │   └── constants.ts      ← Credential type URIs, etc.
│   │   └── tsconfig.json
│   │
│   ├── partner-portal/           ← React app for learning providers
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── pages/
│   │       │   ├── Dashboard.tsx
│   │       │   ├── YouthOnboarding.tsx
│   │       │   ├── Templates.tsx
│   │       │   ├── IssueCredential.tsx
│   │       │   └── Analytics.tsx
│   │       ├── components/
│   │       └── styles/
│   │
│   ├── youth-wallet/             ← React app for youth
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── pages/
│   │       │   ├── Login.tsx
│   │       │   ├── Wallet.tsx
│   │       │   ├── CredentialDetail.tsx
│   │       │   ├── PendingOffers.tsx
│   │       │   └── PresentationRequest.tsx
│   │       ├── components/
│   │       └── styles/
│   │
│   ├── employer-portal/          ← React app for employers
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── pages/
│   │       │   ├── TalentSearch.tsx
│   │       │   ├── YouthProfile.tsx
│   │       │   ├── Notifications.tsx
│   │       │   └── Verification.tsx
│   │       ├── components/
│   │       └── styles/
│   │
│   └── admin-dashboard/          ← React app for ecosystem admins
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── pages/
│           │   ├── Overview.tsx
│           │   ├── Partners.tsx
│           │   ├── Credentials.tsx
│           │   └── Youth.tsx
│           ├── components/
│           └── styles/
│
└── scripts/
    ├── dev.sh                    ← Start proxy + all 4 apps
    └── check-api.sh              ← Quick health check against real API
```

---

## Backend Proxy Design

### Two types of routes

**1. Proxy routes** — pure pass-through to the real API

```
/api/proxy/*  →  forwards to real test API
```

Every proxy route:
- Reads the incoming path after `/api/proxy/`
- Gets a fresh access token (or uses cached, non-expired one)
- Forwards the request to `{YOID_API_BASE_URL}/{path}` with the Bearer token
- Returns the response body and status code unchanged

**2. App-layer routes** — application logic that sits above the credential API

```
/api/app/aggregator/metrics    →  queries real API, aggregates results
/api/app/talent/search         →  searches across youth profiles (anonymised)
/api/app/talent/notify         →  sends opportunity notification
```

These routes call the real API under the hood but add application logic (aggregation, anonymisation, filtering). They are clearly namespaced under `/api/app/` to distinguish them from the pure proxy.

### Environment variables

```bash
# .env (not committed)
YOID_API_BASE_URL=https://test.didxtech.com
YOID_CLIENT_ID=your_client_id
YOID_CLIENT_SECRET=your_client_secret

# Optional: multiple partner credentials for demo
YOID_PARTNER_UMUZI_CLIENT_ID=...
YOID_PARTNER_UMUZI_CLIENT_SECRET=...
YOID_PARTNER_JOBJACK_CLIENT_ID=...
YOID_PARTNER_JOBJACK_CLIENT_SECRET=...
```

### Token management

The auth endpoint path and body format must come from the YoID dev docs. The proxy implements whatever the docs document — no assumptions about Keycloak realm paths or grant types beyond what the docs state.

```typescript
// Simplified token cache
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  
  // ⚠️ Endpoint + body shape MUST come from YoID dev docs
  // If docs don't specify, log GAP and document assumption
  const response = await fetch(`${YOID_API_BASE_URL}/<auth-path-from-dev-docs>`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  
  const data = await response.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 30) * 1000,
  };
  return tokenCache.token;
}
```

### Pre-credential build mode

Before real credentials are available, the proxy starts but returns clear errors:

```json
{
  "error": "NO_CREDENTIALS",
  "message": "YOID_CLIENT_ID and YOID_CLIENT_SECRET are not set. Add them to .env to connect to the real API.",
  "hint": "See .env.example"
}
```

The frontend handles this gracefully — shows a "Not connected" state rather than crashing. This lets you build and review all UI before credentials arrive.

---

## Surface Specifications

### 1. Partner Portal

**Actor:** Learning providers (Umuzi, RLabs, Fundoo, DBE)
**Job:** Onboard youth, issue credentials, track outcomes
**Accent:** Teal

**Pages:**

**Dashboard** — Landing after login
- Quick stats: youth onboarded, credentials issued, pending acceptances
- Quick actions: "Onboard youth", "Issue credential"
- Recent activity feed

**Youth Onboarding** — Create accounts via real API
- Single mode: form with email, first name, last name
- Bulk CSV: upload CSV → batch create
- Shows temp password on success (or confirms email sent)
- Table of onboarded youth with status

**Credential Templates** — Define credential types
- List existing templates
- Create new: name, description, type, attributes (name, type, required, alwaysDisclosed)
- Shows the credential type URI (verifiers need this)

**Issue Credential** — Core action
- Select template → select youth → fill attribute values → issue → deliver to wallet
- Shows status progression (offered → accepted)
- This exercises the full issuance flow from the docs

**Analytics** — M&E view
- Credentials issued over time
- Acceptance rate
- Youth by location
- Powered by app-layer aggregator route

**Design:** Professional, clean. This is a tool for program managers.

### 2. Youth Wallet

**Actor:** Youth (15-25, primarily African markets)
**Job:** See what they've earned, accept new credentials, share with employers
**Accent:** Amber/gold

**Pages:**

**Login** — Email + password. First login forces password change.

**Wallet (home)** — Card grid of accepted credentials
- Each card: credential name, issuer, date, key attributes
- Visual distinction by type (learning = teal card, employment = coral, identity = blue)

**Pending Offers** — Credentials awaiting acceptance
- Accept / Reject per credential
- Accepting moves to wallet

**Credential Detail** — Full view of a single credential
- All attributes, issuer info, issuance date
- Verification indicator

**Presentation Requests** — Respond to employer verify requests
- Who's asking, what they want to see
- Select which credentials to share (selective disclosure)
- Confirm / Decline

**Design:** Warm, mobile-first, empowering. Cards should feel like achievements, not forms.

### 3. Employer Portal

**Actor:** Employers, recruiters (JobJack, corporate HR)
**Job:** Find qualified youth, verify their credentials
**Accent:** Coral

**Pages:**

**Talent Search** — Discovery surface
- Filters: skills, location, credential type, experience level
- Anonymised profile cards (no PII until consent)
- Each card: credential count, skill tags, region, match indicator

**Send Notification** — After selecting from search
- Compose opportunity (type, title, message)
- Youth receive notification; employer sees delivery status, not identity

**Verification** — The trust handshake
- Create presentation template (what credential types to verify)
- Create presentation request (send to youth)
- Status dashboard: requested → verified / rejected
- Once verified, view shared credential data

**Design:** Data-dense, scannable, action-oriented. A hiring tool.

### 4. Admin Dashboard

**Actor:** Ecosystem admins, programme teams
**Job:** Ecosystem health, impact reporting
**Accent:** Blue

**Pages:**

**Overview** — Ecosystem snapshot
- Headline metrics: total youth, total credentials, total partners, acceptance rate
- Credential issuance trend
- Partner activity table

**Credential Analytics**
- By type (chart), issuance velocity, time to acceptance

**Youth Analytics** — Population-level only
- Activation rate, credential accumulation, geographic distribution

**Design:** Dashboard aesthetic. Data visualisation heavy. Stakeholders need scale and impact at a glance.

---

## Claude Code Session Workflow

Each Claude Code session should start with:

1. **User provides YoID dev doc URLs.** The user will paste one or more raw URLs to the YoID dev docs. These are publicly readable raw file URLs from a private GitHub repo.

2. **Agent fetches and reads the docs.** Before writing any API integration code, the agent must fetch each URL and read the full content. This is the equivalent of a partner reading the docs before integrating.

3. **Agent references `ARCHITECTURE.md` for what to build.** This file defines the surfaces, pages, proxy design, and build phases. The dev docs define *how* to call the API.

4. **Agent logs gaps in `docs/dev-docs-gaps.md`.** Any time the docs are ambiguous, missing, or don't match real API behaviour, the agent logs a gap entry before making an assumption.

5. **User provides credentials when ready.** The agent should build everything possible before credentials arrive. When the user adds them to `.env`, the agent runs `scripts/check-api.sh` to verify connectivity, then tests the integration end-to-end.

### Providing doc URLs

The user will provide URLs in a format like:

```
Here are the YoID dev docs:
- Authentication: https://raw.githubusercontent.com/org/yoid-docs/main/authentication.md
- Issuance: https://raw.githubusercontent.com/org/yoid-docs/main/issuance.md
- Verification: https://raw.githubusercontent.com/org/yoid-docs/main/verification.md
```

The agent should store these in `docs/dev-docs-urls.md` for reference across sessions.

---

## Build Plan

### Phase 0: Foundation
**Goal:** Monorepo + proxy + shared types + env template

- [ ] Fetch YoID dev docs from provided URLs, store URL index in `docs/dev-docs-urls.md`
- [ ] Read all dev docs thoroughly before writing any integration code
- [ ] Initialise monorepo with npm workspaces
- [ ] Set up shared types package (types derived from YoID dev docs)
- [ ] Build proxy server with pass-through logic + token management
- [ ] Create `.env.example` with all required variables
- [ ] Implement "not connected" error handling for missing credentials
- [ ] Dev script to start proxy on port 3001
- [ ] Create `docs/dev-docs-gaps.md` with logging template
- [ ] `scripts/check-api.sh` — curl the auth endpoint to verify connectivity

**Exit criteria:** Proxy starts, returns "NO_CREDENTIALS" error cleanly. When creds are added to `.env`, proxy can exchange them for a token and forward a request.

### Phase 1: Partner Portal
**Goal:** A learning provider can onboard youth and issue credentials via real API

- [ ] Scaffold React app with Vite + Tailwind
- [ ] Partner context (which partner are you acting as)
- [ ] Youth onboarding page (calls real create user endpoint through proxy)
- [ ] Credential template management (calls real template endpoints)
- [ ] Issue credential flow (template → attributes → issue → deliver)
- [ ] Basic analytics page
- [ ] Log any dev docs gaps encountered during implementation

**Exit criteria:** The full issue flow works against the real API. Dev docs gaps logged.

### Phase 2: Youth Wallet
**Goal:** A youth can log in, see credentials, accept pending offers

- [ ] Scaffold React app (mobile-first)
- [ ] Login with email + temp password
- [ ] Wallet home with credential cards (fetched from real API)
- [ ] Pending offers with accept/reject
- [ ] Credential detail view
- [ ] Presentation request response flow

**Exit criteria:** A credential issued in Phase 1 appears in the youth wallet and can be accepted.

### Phase 3: Employer Portal
**Goal:** An employer can find youth and verify credentials

- [ ] Scaffold React app
- [ ] Talent search (app-layer route, queries real data)
- [ ] Anonymised profile cards
- [ ] Send notification
- [ ] Create presentation request (real API)
- [ ] Verification results view

**Exit criteria:** Employer can request credential presentation, youth consents in wallet, employer sees verified data.

### Phase 4: Admin Dashboard
**Goal:** Ecosystem overview from real API data

- [ ] Scaffold React app
- [ ] Overview with metrics (app-layer aggregator queries real API)
- [ ] Credential analytics with charts (Recharts)
- [ ] Partner activity
- [ ] Youth population analytics

**Exit criteria:** Dashboard reflects real state of the test environment.

### Phase 5: Polish + Demo Script
**Goal:** End-to-end demo flows cleanly

- [ ] Write `docs/demo-script.md` — step-by-step walkthrough
- [ ] Cross-app navigation helpers
- [ ] Loading, error, empty states
- [ ] Responsive polish (partner + employer = desktop, youth = mobile)
- [ ] Review and finalise `docs/dev-docs-gaps.md`
- [ ] Deploy

**Exit criteria:** Non-technical stakeholder can follow demo script. Dev docs gaps catalogued.

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | npm workspaces | Simple, Claude Code handles it well |
| Frontend | React + Vite | Fast builds, good code generation |
| Styling | Tailwind CSS | Consistent, fast iteration |
| Charts | Recharts | React-native, composable |
| Proxy | Express + TypeScript | Lightweight pass-through |
| State mgmt | React context + hooks | No Redux for a demo |
| API client | Typed fetch in shared package | One proxy base URL to configure |
| Real API | YoID test environment | The whole point — validate the docs |
| Auth | OAuth client credentials via proxy | Secrets stay server-side |

---

## Design Tokens

Each app has its own accent but shares a foundation:

```css
/* Foundation */
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;

/* Slate scale (shared) */
--gray-50 through --gray-900 (Tailwind slate)

/* Per-app accents */
Partner Portal:  teal   (#0F6E56)
Youth Wallet:    amber  (#BA7517)
Employer Portal: coral  (#993C1D)
Admin Dashboard: blue   (#185FA5)
```

---

## Credential Flow Sequence

```
Partner Portal                    YoID API                    Youth Wallet                  Employer Portal
     │                               │                             │                              │
     │── Create user ───────────────►│                             │                              │
     │◄── { email, tempPw } ────────│                             │                              │
     │                               │                             │                              │
     │── Create template ──────────►│                             │                              │
     │◄── { id, type, ... } ───────│                             │                              │
     │                               │                             │                              │
     │── Issue credential ─────────►│                             │                              │
     │◄── { offerUri, ... } ───────│                             │                              │
     │                               │                             │                              │
     │── Deliver to wallet ────────►│── credential appears ─────►│                              │
     │                               │                             │                              │
     │                               │                             │── Accept credential          │
     │                               │                             │                              │
     │                               │                   ┌────────│◄── Request presentation ─────│
     │                               │                   │        │                              │
     │                               │                   │        │── Youth consents ───────────►│
     │                               │                   └───────►│                              │
     │                               │                             │── Verified data ────────────►│
     │                               │                             │                              │
```

Each arrow = a real API call. If the YoID dev docs can't support any arrow, that's a gap.

---

## Demo Script Outline

One credential, full lifecycle:

1. **Partner Portal (Umuzi):** Issue "React Developer Badge" to Debora
2. **Youth Wallet (Debora):** See pending credential, accept it
3. **Employer Portal (JobJack):** Search for web dev credentials, find Debora anonymised, send notification, request presentation
4. **Youth Wallet (Debora):** See presentation request, consent to share
5. **Employer Portal (JobJack):** See verified credentials
6. **Admin Dashboard:** Metrics reflect the full lifecycle

**Punchline:** Four independent systems, one credential lifecycle, zero phone calls or PDFs.

---

## Open Questions

1. **Multiple partner credentials:** The demo needs at least two partners (one issuer, one verifier). Does each get their own clientId/secret? This affects proxy auth logic.

2. **Youth wallet auth:** The docs document the partner-side OAuth flow. How do youth authenticate to view their wallet? Separate user-facing auth flow, or same Keycloak instance with user credentials?

3. **Wallet read endpoints:** Issuance flow is documented. What endpoints does a youth use to LIST their credentials and RESPOND to presentation requests? If absent from YoID dev docs, this is the biggest gap.

4. **App-layer features:** Talent search and M&E aggregation sit above the credential API. Are there existing endpoints for listing all users/credentials, or does the app need to build this from individual queries?

---

## Dev Docs Validation Checklist

After build, the docs should demonstrably support:

- [ ] OAuth token exchange (client credentials flow)
- [ ] Create user account → receive temp password
- [ ] Create credential template → receive template ID + type URI
- [ ] Issue credential using template → receive offerUri
- [ ] Deliver credential to wallet via email
- [ ] Youth views pending credentials
- [ ] Youth accepts a credential
- [ ] Youth views accepted credentials
- [ ] Create presentation template
- [ ] Create presentation request → receive authorizationRequestUri
- [ ] Youth responds to presentation request
- [ ] Verifier retrieves verified presentation data

Any unchecked item at the end of the build = a dev docs gap to fix.
