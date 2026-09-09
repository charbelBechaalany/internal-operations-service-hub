# Week 2 Agentic Workflow

How the request lifecycle was understood, directed, and proven.

Companion to `product-spec.md`, `architecture.md`, and `data-model.md`.

---

## Understand

### Week 1 sources used

**`product-spec.md`** — the five states, the rule that assignment needs approval, that Completed and Cancelled are final, and that every refusal must explain itself.

**`architecture.md`** — ADR-1, the lifecycle stays in one service so there is no second path around the rules. ADR-2, relational storage, which is why the repository sits behind an interface.

**`data-model.md`** — the transition table, and the rule about where a rule lives. It places the ordering invariant in domain logic because a database constraint cannot see the order of states over time.

### States and transitions

Five states: Submitted, Approved, In Progress, Completed, Cancelled.

| From | Action | To |
|---|---|---|
| — | create | Submitted |
| Submitted | approve | Approved |
| Approved | assign | In Progress |
| In Progress | assign | In Progress |
| In Progress | complete | Completed |
| Submitted, Approved, In Progress | cancel | Cancelled |

Anything not on this list does not happen.

Assign appears twice. From Approved it starts the work, from In Progress it reassigns. The data model treats reassignment as a change of owner, not of state.

### The invariant

**A request cannot be assigned before it is approved, and cannot be completed before it is assigned.**

It cannot be a database constraint, because it is a rule about the order of states over time. The data model places it in domain logic, and this implementation puts it in one transition table read by one method.

### Implementation area

`apps/api/` — one NestJS module.

The boundary that matters is `requests/domain/`, which imports nothing from NestJS. The rules are plain types and functions.

Every status change passes through one private method in `requests.service.ts`. The four public actions are four doors into the same corridor. No second path can skip the check.

### Non-goals

- **No database.** In-memory is acceptable this week. The repository interface makes a real store a one-line swap.
- **No auth.** Out of scope. Every rule here is decided by state alone.
- **No assignee validation.** `assigneeId` is recorded, not checked. Validating it needs identity.
- **No audit trail or history.** In the data model, but a second concept.
- **No reroute.** In the spec, but it changes ownership rather than status.
- **No attachments, topics, notifications, or reporting.** Week 1 scope, not needed here.
- **No frontend, no test suite.**

---

## Direct

### The bounded task

One behaviour: the lifecycle state machine. Six transitions that succeed, six that are rejected, one invariant.

Scope and non-goals were fixed before any code was written, so later decisions had a boundary to be measured against.

### Context supplied

The three Week 1 documents in full, not summaries. The transition table came out of the data model verbatim, and the requirement that a refusal explain itself came from one line in the spec.

### Inspect before modifying

The scaffold was inspected before anything was added. That surfaced `@nestjs/observe`, enabled by a prompt during scaffolding, logging telemetry errors on every startup.

It was removed rather than configured. The architecture argues that every component needs a reason to exist, and this one had none.

The scaffold's placeholder controller, service, and e2e test were also removed once real routes existed.

### Plan before execution

Ten steps planned before the first file: scaffold, domain, errors, repository, service, controller, wiring, verification, documentation.

Each committed separately, so the history shows layers arriving in dependency order. The domain came first because everything depends on it.

### Approve, redirect, stop

**Scope was cut.** The first plan included an audit module, seeded users, and a history endpoint. Redirected: the milestone asks for one behaviour, and those are separate concepts. Moved to non-goals.

**Authorization was stopped.** The plan had three rejection cases from authorization rules, fed by an `X-User-Id` header. Auth is out of scope, and a fake identity header is still identity. All six rejections were reworked to be decided by state alone, which made the evidence cleaner.

**A case was added.** The plan proved assignment cannot precede approval. Submitted going straight to Completed was added, since it skips two steps rather than one. Completing from Approved was added alongside it, so the ordering is shown to hold at every step.

---

## Prove

All cases run against one instance, since in-memory storage does not survive a restart.

### Valid transitions

| # | Action | Expected | Actual |
|---|---|---|---|
| 1 | Create | 201, Submitted | ✓ |
| 2 | Approve from Submitted | 200, Approved | ✓ |
| 3 | Assign from Approved | 200, InProgress | ✓ |
| 4 | Reassign from InProgress | 200, InProgress, assignee changed | ✓ |
| 5 | Complete from InProgress | 200, Completed | ✓ |
| 6 | Cancel from Submitted | 200, Cancelled | ✓ |

Case 4 leaves the status untouched and changes only the assignee, which is what the data model describes.

### Invalid transitions

All return 409 with the current status and attempted action in the body.

| # | Attempt | Expected message | Actual |
|---|---|---|---|
| 1 | Assign while Submitted | cannot be assigned before approved | ✓ |
| 2 | Complete while Submitted | cannot be completed before approved and assigned | ✓ |
| 3 | Complete while Approved | cannot be completed before assigned | ✓ |
| 4 | Approve while Approved | already approved | ✓ |
| 5 | Cancel while Completed | Completed is final | ✓ |
| 6 | Approve while Cancelled | Cancelled is final | ✓ |

Cases 1 to 3 are the invariant. Assignment needs approval, completion needs assignment, no shortcut between them.

Cases 5 and 6 show terminal means terminal.

### Two further checks

**Unknown request.** `GET /requests/does-not-exist` returns 404 with `REQUEST_NOT_FOUND`. Separate from a refused transition, because "cannot move" and "does not exist" are different answers.

**A client naming a target state.** Creating a request with an extra `status` field returns 400. The field is rejected, not ignored.

That check matters. The design rests on the server deciding transitions, which is why the API uses POSTs to named actions rather than a PATCH that sets a status.

### Regression check

After the final wiring change, which added validation and the exception filter and removed the scaffold placeholders, all fourteen cases were run again from a cold start. Same results.

### Defects

None. The only issue found was the scaffold's observability agent, caught during inspection before any of this code existed, and removed.

---

## What this proves, and what it does not

**Proves.** The five states exist in code. The legal moves are one table, not scattered conditionals. Every status change passes through one method. An illegal move leaves the request untouched.

**Does not prove.** Anything about durability, concurrency, or identity. The store is a Map, two simultaneous transitions on one request have not been considered, and nothing checks who is acting. Each is named as a non-goal above.