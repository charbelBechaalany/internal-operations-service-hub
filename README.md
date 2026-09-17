# Internal Operations Service Hub

A centralized system for raising, routing, and tracking internal help requests
across company departments. An employee raises a request against a department,
the head of that department approves and assigns it, and the requester follows a
single status from submission to completion.

Built for the Eurisko Academy AI Full Life-Cycle for Developers program.

## Documents

- [Product Specification](docs/product-spec.md) — the problem, who is involved,
  what the product must do, what is known and unknown, and what is deliberately
  out of scope
- [Architecture](docs/architecture.md) — components, information flows, trust
  boundaries, failure handling, and the decision records behind the design
- [Data Model](docs/data-model.md) — what the system remembers, how it connects,
  which rules keep it trustworthy, and how real queries find it
- [API Contract](docs/api-contract.md) — exactly what `apps/api/src/requests`
  accepts and returns today, including where it does less than the spec
- [Week 2 Agentic Workflow](docs/week2-agentic-workflow.md) — how the lifecycle
  state machine was understood, directed, and proven
- [Week 3 Full-Stack Delivery](docs/week3-full-stack-delivery.md) — how it got a
  real database, a real actor, a real authorization rule, and a real browser
  client, and the defect found on the way

---

## What is implemented

The five-state request lifecycle from Week 1/2, now running full-stack:

```
Submitted ──approve──> Approved ──assign──> In Progress ──complete──> Completed
    │                     │                      │
    └──────────────── cancel ───────────────────┘
                          ↓
                      Cancelled
```

The server decides which moves are legal; a move not in the transition table
does not happen, and the request is left exactly as it was. Completed and
Cancelled are final.

- **Persistence.** SQLite via TypeORM, not memory. A request survives an API
  restart.
- **Authorization.** Only the head of a request's owning department may
  approve or assign it. Every other rule is still decided by state alone.
- **A frontend.** A React app that lets you act as any seeded user, raise a
  request, and work a department queue.
- **Four layers of automated tests** — domain unit, service integration, API
  contract, and browser end-to-end. See [Running the tests](#running-the-tests).

## Deliberately out of scope

Not gaps — named boundaries for this slice. Full detail in
`docs/product-spec.md`'s Non-Goals and `docs/api-contract.md` §1.

- **No authentication.** The acting user arrives as an `X-User-Id` header and
  is never verified. Identity is asserted, not proven.
- **No actor check on complete or cancel.** The spec says only the assignee
  may complete and only the HOD (or the requester, while Submitted) may
  cancel. Neither is enforced — anyone who can reach those endpoints can call
  them.
- **No enforced visibility.** `GET /requests` and `GET /requests/:id` return
  every request to every caller. The department queue in the browser only
  *displays* a narrower view (the head sees everything, anyone else sees only
  what's assigned to them) — that's a UI default, not a security boundary.
- **No assignee validation.** `assigneeId` is stored as sent; nothing checks
  it names a real user or a member of the department.
- **No audit log.** A denied action is refused correctly and recorded
  nowhere.
- **No reroute, attachments, topics, notifications, or reporting.** Week 1
  scope, none of it needed to prove this slice.

---

## Running it

Requires Node (18+) and nothing else. Two independent apps, no workspace
tooling — install and run each from its own directory. Use two terminals: the
API keeps running in one while you use the web app in the other.

### 1. API

```bash
cd apps/api
npm install
npm run migration:run
npm run seed
npm run start:dev
```

`migration:run` creates the SQLite schema at `apps/api/data/app.sqlite`
(the directory is created automatically). `seed` inserts the fixed
departments, users, and one sample request listed below. `start:dev` serves
the API on `http://localhost:3000` and reloads on change. Leave it running.

### 2. Web app

In a second terminal:

```bash
cd apps/web
npm install
npm run dev
```

Serves on `http://localhost:5173` and proxies `/requests` to the API on
port 3000 (`vite.config.ts`), so both land on the same origin. Open
`http://localhost:5173`.

### Seeded data

Fixed ids from `apps/api/src/database/seed.ts`, inserted by `npm run seed`:

| User | Department | Role |
|---|---|---|
| `user-it-head` | IT (`dept-it`) | Head — may approve/assign IT requests |
| `user-it-member-1` | IT (`dept-it`) | Member — may not approve/assign |
| `user-it-member-2` | IT (`dept-it`) | Member — may not approve/assign |
| `user-hr-head` | HR (`dept-hr`) | Head — may approve/assign HR requests |
| `user-requester` | HR (`dept-hr`) | Requester, no special role |

One sample request, `request-it-1` ("New laptop request"), is seeded
Submitted against IT, raised by `user-requester`.

---

## Exercise the slice in the browser

With both apps running, at `http://localhost:5173`:

**1. Create a request.** "Acting as" defaults to the first seeded user. Use
the "Create a request" form to raise one against **IT** — any acting user can
do this. It appears Submitted.

**2. The allowed case.** Switch "Acting as" to **IT Head** (`user-it-head`) —
the head of IT, the only user authorized to act on it. Find the request in
the IT queue, click **Approve**, confirm. It moves to Approved. Click
**Assign**, choose **IT Member 1**, confirm. It moves to In Progress with IT
Member 1 as assignee. Both calls succeed because the acting user is the
department's head.

**3. The denied case.** Switch "Acting as" to **IT Member 1**
(`user-it-member-1`) — a member of IT, but not its head. The request is
still visible (it's assigned to this user; a non-head only sees their own
department's queue for work already assigned to them). Click **Reassign**,
choose **IT Member 2**, confirm. The request stays In Progress, still
assigned to IT Member 1, and a banner reads:

> Only the head of department dept-it may perform this action.

Same rule as step 2, refused, because IT Member 1 is not the head. The
server enforces this regardless of which button the UI happened to show —
see `docs/week3-full-stack-delivery.md`'s Authorization section for why the
denied case is demonstrated as a reassignment rather than an approval.

---

## API summary

| Method | Path | Header | Body |
|---|---|---|---|
| POST | `/requests` | `X-User-Id` | title, description, departmentId |
| GET | `/requests` | — | — |
| GET | `/requests/:id` | — | — |
| POST | `/requests/:id/approve` | `X-User-Id` | — |
| POST | `/requests/:id/assign` | `X-User-Id` | assigneeId |
| POST | `/requests/:id/complete` | — | — |
| POST | `/requests/:id/cancel` | — | reason |

Transitions are POSTs to named actions, never a PATCH that sets a status
field — the client asks for an action, the server decides what state it
produces. An unknown body field (e.g. `status`) is rejected, not ignored:

```bash
curl -X POST http://localhost:3000/requests \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-requester" \
  -d '{"title":"x","description":"y","departmentId":"dept-it","status":"Completed"}'
# 400 { "message": ["property status should not exist"], "error": "Bad Request" }
```

This table is a summary. `docs/api-contract.md` is the source of truth for
exact request/response shapes, the full error-code list, and the order
checks run in.

---

## Running the tests

Everything below is automated — this is the actual way to verify the system,
not the browser walkthrough above.

### API: unit and integration

```bash
cd apps/api
npm test
```

**Use `npm test`, not `npx jest` or a bare `jest`.** The script is `node
--experimental-vm-modules node_modules/jest/bin/jest.js`, not plain `jest` —
running `jest` directly skips that flag. This single command runs both:

- **Domain unit tests** (`src/requests/domain/transitions.spec.ts`) — the
  transition table in isolation, no NestJS, no database.
- **Service integration tests**
  (`src/requests/requests.service.integration.spec.ts`) — the real service
  against a real in-memory SQLite database via TypeORM, not a mock
  repository.

No server needs to be running first; each test manages its own database
connection.

### Web: end-to-end (API contract + browser)

```bash
cd apps/web
npx playwright install   # one-time, downloads the browser binaries
npm run test:e2e
```

**Nothing needs to be running first.** `playwright.config.ts` boots its own
API server against its own SQLite file (`apps/api/data/e2e.sqlite`, separate
from the one `npm run start:dev` uses), resetting it, running migrations,
and seeding it fresh before the suite starts — see `test:e2e:server` in
`apps/api/package.json`. It also starts the Vite dev server. Both are torn
down as background processes the test runner owns; you don't start or stop
either yourself.

This runs two suites:

- `e2e/transitions.spec.ts` — all twelve Week 2 transition cases (six valid,
  six invalid), asserted as real HTTP status codes and error codes against
  the running API.
- `e2e/approve-authorization.spec.ts` — the allowed and denied authorization
  cases above, driven through a real Chromium browser.

`npm run test:e2e:ui` runs the same suite interactively; `npm run
test:e2e:report` opens the HTML report from the last run.

---

## Rejection shape

Every refused transition returns the same body, so the reason is readable
without parsing prose:

```json
{
  "error": "INVALID_TRANSITION",
  "message": "A request cannot be assigned before it has been approved.",
  "currentStatus": "Submitted",
  "attemptedAction": "Assign"
}
```

**409, not 400.** A refused transition is not malformed input — the body is
valid, the id exists, the action is real. What's wrong is that the request
is in a state where the move isn't allowed, which is a conflict with current
state, not a validation failure.

A second, distinct 409 — `REQUEST_CONFLICT` — means something different: the
move was legal against the state the caller read, but someone else's write
landed first. `docs/api-contract.md` §3 and `docs/week3-full-stack-delivery.md`
explain why the two are never collapsed into one code.

---

## Code structure

```
apps/api/src/
├── main.ts                          bootstrap, validation, error filter
├── app.module.ts
├── common/                          domain errors + the filter mapping them to HTTP
│   ├── invalid-transition.error.ts
│   ├── not-department-head.error.ts
│   ├── request-conflict.error.ts
│   ├── request-not-found.error.ts
│   ├── actor-id.decorator.ts        reads X-User-Id
│   └── domain-exception.filter.ts
├── database/
│   ├── data-source.ts               TypeORM connection, shared by app and CLI
│   ├── migrations/
│   └── seed.ts                      fixed departments, users, one request
├── departments/, users/             read-only supporting data, no controllers
└── requests/
    ├── domain/                      pure TypeScript, no NestJS or ORM imports
    │   ├── request-status.enum.ts
    │   ├── request-action.enum.ts
    │   ├── request.entity.ts
    │   ├── transitions.ts           the legal table and refusal messages
    │   └── transitions.spec.ts
    ├── dto/
    ├── infrastructure/               TypeORM repository + mapper
    ├── requests.repository.ts       the port
    ├── requests.service.ts          the single path for a status change
    ├── requests.controller.ts
    ├── requests.module.ts
    └── requests.service.integration.spec.ts

apps/web/src/
├── main.tsx, App.tsx                the acting-user switcher and page layout
├── CreateRequestForm.tsx
├── DepartmentQueue.tsx              the queue table, visibility filter, actions
├── ConfirmDialog.tsx, ErrorBanner.tsx, RequestDetailsDialog.tsx
├── users.ts                         mirrors the API's seed, since there's no
│                                     /users endpoint yet
└── api/                             typed client + response shapes

apps/web/e2e/                        Playwright: API-contract and browser suites
```

**`requests/domain/` imports nothing from NestJS or an ORM.** The state
machine is plain types and functions, readable without knowing the
framework, and testable without a database.

**One private method owns every status change.** `approve`, `assign`,
`complete`, and `cancel` are four doors into the same corridor in
`requests.service.ts`. There is no second path that could skip the
transition check, which is what turns the invariant into a guarantee rather
than a convention.
