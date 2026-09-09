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
- [Week 2 Agentic Workflow](docs/week2-agentic-workflow.md) — how this
  implementation was understood, directed, and proven

---

## What is implemented

One bounded backend behaviour: **the request lifecycle state machine.**

A request moves through five states. The server decides which moves are legal.
A move that is not in the transition table does not happen, and the request is
left exactly as it was.

```
Submitted ──approve──> Approved ──assign──> In Progress ──complete──> Completed
    │                     │                      │
    └──────────────── cancel ───────────────────┘
                          ↓
                      Cancelled
```

Completed and Cancelled are final.

## Not implemented this week

Deliberate boundaries, not gaps.

- **No database.** Requests are held in memory and are lost on restart. The
  repository sits behind an interface, so a real store replaces one line in
  `requests.module.ts`.
- **No authentication or authorization.** The specification's rules about who
  may approve, assign, or complete need identity, which is out of scope. Every
  rule enforced here is decided by the request's current state alone.
- **No assignee validation.** `assigneeId` is recorded but not checked against a
  user directory, because there are no users this week.
- **No audit trail or history endpoint.** In the data model, not in this
  milestone.
- **No reroute, attachments, topics, notifications, or reporting.** All Week 1
  scope, none of it needed to prove the state machine.
- **No frontend and no test suite.**

---

## Running it

Requires Node 18 or later.

```bash
cd apps/api
npm install
npm run start:dev
```

The API listens on `http://localhost:3000`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/requests` | Create a request. It enters Submitted. |
| GET | `/requests` | List every request currently held. |
| GET | `/requests/:id` | Read one request. |
| POST | `/requests/:id/approve` | Submitted → Approved |
| POST | `/requests/:id/assign` | Approved → In Progress, or reassign |
| POST | `/requests/:id/complete` | In Progress → Completed |
| POST | `/requests/:id/cancel` | Any non-final state → Cancelled |

Transitions are POSTs to named actions rather than a PATCH that sets a status
field. That is deliberate: a client asks for an action, and the server decides
what state it produces. A client cannot name a target state.

---

## Verifying it

Storage is in memory, so run these in one session without restarting the server.
Each step gives the request created in the previous one, referred to below as
`{id}`.

### Valid transitions, all six succeed

**1. Create a request**

```bash
curl -X POST http://localhost:3000/requests \
  -H "Content-Type: application/json" \
  -d '{"title":"Laptop replacement","description":"Screen is cracked"}'
```

Expected: **201**, `"status": "Submitted"`. Copy the `id`.

**2. Approve it**

```bash
curl -X POST http://localhost:3000/requests/{id}/approve
```

Expected: **200**, `"status": "Approved"`

**3. Assign it**

```bash
curl -X POST http://localhost:3000/requests/{id}/assign \
  -H "Content-Type: application/json" \
  -d '{"assigneeId":"u-it-1"}'
```

Expected: **200**, `"status": "InProgress"`, `"assigneeId": "u-it-1"`

**4. Reassign it**

```bash
curl -X POST http://localhost:3000/requests/{id}/assign \
  -H "Content-Type: application/json" \
  -d '{"assigneeId":"u-it-2"}'
```

Expected: **200**, still `"status": "InProgress"`, now `"assigneeId": "u-it-2"`.
Reassignment changes who holds the request without changing where it is in its
lifecycle.

**5. Complete it**

```bash
curl -X POST http://localhost:3000/requests/{id}/complete
```

Expected: **200**, `"status": "Completed"`, `completedAt` set.

**6. Cancel a different request while it is still Submitted**

Create a second request, then:

```bash
curl -X POST http://localhost:3000/requests/{id2}/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason":"No longer needed"}'
```

Expected: **200**, `"status": "Cancelled"`

### Invalid transitions, all six rejected

Create a third request for these. It starts Submitted.

**1. Assign before approving**

```bash
curl -X POST http://localhost:3000/requests/{id3}/assign \
  -H "Content-Type: application/json" \
  -d '{"assigneeId":"u-it-1"}'
```

Expected: **409**
`A request cannot be assigned before it has been approved.`

**2. Complete straight from Submitted**

```bash
curl -X POST http://localhost:3000/requests/{id3}/complete
```

Expected: **409**
`A request cannot be completed before it has been approved and assigned.`

**3. Complete from Approved, with nobody assigned**

Approve `{id3}` first, then:

```bash
curl -X POST http://localhost:3000/requests/{id3}/complete
```

Expected: **409**
`A request cannot be completed before it has been assigned.`

**4. Approve something already approved**

```bash
curl -X POST http://localhost:3000/requests/{id3}/approve
```

Expected: **409**
`This request has already been approved.`

**5. Act on a Completed request**

Using `{id}` from valid step 5:

```bash
curl -X POST http://localhost:3000/requests/{id}/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason":"changed my mind"}'
```

Expected: **409**
`A request that is Completed is final and cannot be changed.`

**6. Act on a Cancelled request**

Using `{id2}` from valid step 6:

```bash
curl -X POST http://localhost:3000/requests/{id2}/approve
```

Expected: **409**
`A request that is Cancelled is final and cannot be changed.`

### Two further checks

**Unknown request**

```bash
curl http://localhost:3000/requests/does-not-exist
```

Expected: **404**, `"error": "REQUEST_NOT_FOUND"`

**A client trying to set the status directly**

```bash
curl -X POST http://localhost:3000/requests \
  -H "Content-Type: application/json" \
  -d '{"title":"x","description":"y","status":"Completed"}'
```

Expected: **400**. The status field is not part of the request contract, so it
is rejected rather than ignored. A client cannot bypass the state machine by
naming a target state.

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

**409, not 400.** A refused transition is not malformed input. The body is
valid, the id exists, the action is real. What is wrong is that the request is
in a state where the move is not allowed, which is a conflict with current
state. 400 is reserved for validation.

The specification requires every refusal to say what happened and what to do
next, which is why the body carries the current status and the attempted action
rather than only a message.

---

## Code structure

```
apps/api/src/
├── main.ts                          bootstrap, validation, error filter
├── app.module.ts
├── common/
│   ├── invalid-transition.error.ts
│   ├── request-not-found.error.ts
│   └── domain-exception.filter.ts   maps domain errors to HTTP
└── requests/
    ├── domain/                      pure TypeScript, no NestJS imports
    │   ├── request-status.enum.ts   the five states
    │   ├── request-action.enum.ts   the four commands
    │   ├── request.entity.ts        what a request holds
    │   └── transitions.ts           the legal table and refusal messages
    ├── dto/
    ├── requests.repository.ts       the interface
    ├── in-memory-requests.repository.ts
    ├── requests.service.ts          the single path for a status change
    ├── requests.controller.ts
    └── requests.module.ts
```

**`domain/` imports nothing from NestJS.** That is the one boundary that
matters here. The state machine is plain types and functions, so the rules from
Week 1 can be read without knowing the framework.

**One private method owns every status change.** `approve`, `assign`,
`complete`, and `cancel` are four doors into the same corridor in
`requests.service.ts`. There is no second path that could skip the transition
check, which is what turns the invariant from an intention into a guarantee.