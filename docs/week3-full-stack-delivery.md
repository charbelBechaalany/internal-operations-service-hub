# Week 3 Full-Stack Delivery

How the lifecycle proved in Week 2 got a real database, a real actor, a real
authorization rule, and a real browser client — and what broke on the way.

Companion to `product-spec.md`, `architecture.md`, `data-model.md`, and
`api-contract.md`.

---

## The slice, and why this one

Week 2 proved the state machine in isolation: an in-memory store, no actor,
no client. Week 3 had to carry one real behaviour through every new layer —
SQLite, an `X-User-Id` header, an authorization check, and a React UI — rather
than adding each layer under a different feature.

`CLAUDE.md` names the slice: a head of department approving and assigning a
request. It is also the first happy scenario `product-spec.md` states —
*"A request is approved and assigned"* — so it is not an arbitrary choice.
It is the smallest flow that touches domain, persistence, HTTP, authorization,
and UI at once, and it reuses the invariant Week 2 already proved (approval
gates assignment) instead of introducing a second one.

---

## Authorization

**The rule** (`data-model.md`): *"Only the head of the owning department may
approve, assign, reassign, or reroute."* `requests.service.ts` checks this in
`assertIsDepartmentHead` before `approve` and `assign` ever reach the
transition table — a stored `headId` on the request's department compared to
the caller's `X-User-Id`, nothing derived.

**Allowed.** The IT head approves a submitted IT request: `POST
/requests/:id/approve` with `X-User-Id: user-it-head` returns `200`, and
`approve-authorization.spec.ts`'s first test confirms the status pill updates
to Approved on screen and a fresh `GET` shows the same thing in the database.

**Denied.** An IT member who is not the head gets `403 NOT_DEPARTMENT_HEAD`.
The test proving this acts on a request already assigned to that member
(reassigning it), not an unassigned Submitted one — a Submitted request has
no assignee yet, and a department member's queue only ever shows requests
assigned to them (see Non-goals), so it never appears there to attempt
Approve on in the first place. The rule under test is identical; only the
action instance changed. The refusal is asserted twice: once as a direct API
call, capturing the server's exact message, and once through the UI, checking
the rendered banner equals that captured message rather than a guessed
paraphrase.

---

## Rejected on purpose: the invalid request

Week 2 proved by hand that a client naming a target `status` field is
rejected, not ignored — the server decides transitions, not the caller.
Week 3 carries that rule through a real HTTP layer: `main.ts` configures
Nest's `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted:
true`, so any field a DTO does not declare is rejected outright. Verified
directly against the running API:

```
POST /requests { title, description, departmentId, status: "Approved" }
→ 400 { "message": ["property status should not exist"], "error": "Bad Request" }
```

Same design principle as Week 2, now enforced by a framework mechanism
instead of asserted by hand, and recorded as a contract guarantee in
`api-contract.md` §1.

---

## Handled on purpose: the expected failure

Two actors can load the same request, and one can write after the other
without either knowing. This was never invented for Week 3 — it is a promise
`architecture.md` already made:

> "Two people acting at once | Both open the same request | The second action
> is checked against the current state and rejected if it moved, showing the
> actor what is actually true."

and `product-spec.md`:

> "If a HOD assigns a request that has just been cancelled or reassigned by
> someone else, the second action is rejected and the actor is shown the
> current state rather than silently overwriting it."

Week 3 is where that promise got a mechanism: `TypeOrmRequestsRepository.save()`
does a conditional `UPDATE ... WHERE id = :id AND version = :version`. Zero
rows affected means someone else's write landed first, and the service turns
that into `409 REQUEST_CONFLICT` carrying a fresh read of what is actually
stored — not a generic retry-me error. `requests.service.integration.spec.ts`
proves this against a real table, not a mock, in its third test.

`REQUEST_CONFLICT` is deliberately a different code from `INVALID_TRANSITION`
even though both are `409`: one says the move is illegal no matter who asked;
the other says it was legal against what the actor saw, and lost a race.
`api-contract.md` §3 documents the distinction so a client doesn't collapse
both into "409, refuse and complain."

---

## Proof: four kinds of test, four boundaries

| Test | Where | What it protects |
|---|---|---|
| Domain unit | `apps/api/src/requests/domain/transitions.spec.ts` | The rule table itself — pure functions, no NestJS, no ORM, no I/O. Can't pass because a database happened to cooperate. |
| Service integration | `apps/api/src/requests/requests.service.integration.spec.ts` | The service-to-database boundary — real SQLite via TypeORM, real `DepartmentsModule`, no mocked repository. Can't pass because a stub quietly disagreed with the real schema. |
| API contract | `apps/web/e2e/transitions.spec.ts` | The deployed HTTP contract — the real twelve Week 2 cases, run as real status codes and error codes against a running server with a seeded department. Can't pass because a status code changed but nobody rewired the mock that asserted it. |
| Browser E2E | `apps/web/e2e/approve-authorization.spec.ts` | What a person actually sees — real Chromium, real clicks. Can't pass because the wire is correct but the UI never rendered it. |

Each layer catches a failure the layers around it structurally cannot. A unit
test cannot catch a broken SQL query. An integration test cannot catch a
wrong HTTP status code — it never goes through the controller. A contract
test cannot catch a refusal that the UI computes correctly but never
displays. Running all twelve transition cases through a browser would work,
but slowly and flakily; the contract layer is where volume belongs, the
browser layer is where one or two representative flows belong.

**Why the integration test's second assertion is the point.** Its first test
asserts `approved.status` is `Approved` — but that passes even against a
broken repository that mutates the in-memory object and never touches the
database, because `approve()` returns that same mutated object either way.
The second assertion re-fetches through `service.findById()`, a separate read
that owes nothing to the object the first call handed back. Only that read
proves the write reached SQLite. A unit test already proves the *logic* is
right; the integration test's job is to prove the *persistence* is, and the
first assertion alone would not have done that.

---

## The defect: version not written back

**Found** while writing `api-contract.md` §1's claim that "every success
response carries the version the write actually produced" — stating that
guarantee required checking it was true, and it wasn't.

**Reproduce.** Read a request, save a change to it, then save a second
change to that same object without re-reading in between — one caller, no
one else touching the row. Expected: the stored version advances by one on
each save, and the object reflects it. Actual: after the first save,
`request.version` still holds the number it had *before* that save, not
after. `requests.service.integration.spec.ts`'s third test pins this down
directly: it asserts `firstActorsCopy.version` equals the pre-save version
plus one immediately after `repository.save(firstActorsCopy)` succeeds.

**Root cause.** `TypeOrmRequestsRepository.save()` computed the new version
and wrote it into the database row, but never wrote it back onto the
caller's in-memory `request.version`. The port's contract
(`requests.repository.ts`) requires both: "save() must also write the
version it actually persisted back onto `request.version` before
returning." The implementation satisfied the database half and silently
dropped the object half.

**Consequence.** Any caller holding the object handed back from a successful
save — including every success response's `version` field — was one version
behind reality. A second write built on that object would send the old
version in its conditional `WHERE`, which the database had already moved
past, and get refused with `StaleWriteError` against its own prior write:
a false conflict, not a real one.

**Fix** (commit `c6dbaef`): after both the insert path (new record) and the
conditional-update path (existing record), write the version actually
persisted back onto `request.version` before returning, in both branches of
`save()`.

**Verified.** Re-ran the integration suite; the write-back assertion passes.
Also verified live against the running API — one caller, two consecutive
writes, no one else touching the row:

```
POST /requests           → version 1
POST /requests/:id/approve (same caller) → version 2
POST /requests/:id/assign  (same caller) → version 3
```

No gaps, no false conflict.

---

## Non-goals

Carried forward from `product-spec.md`'s own Non-Goals, not silently dropped:

- **Authentication is still deferred.** The acting user arrives as an
  `X-User-Id` header and is never verified — identity is asserted, not
  proven. The authorization rule above is real and enforced; what is missing
  is proof the caller is who the header claims.
- **Queue visibility is a display filter, not enforcement.** `GET /requests`
  and `GET /requests/:id` apply no filtering — every request is visible to
  every caller who reaches the endpoint (`api-contract.md` §1).
  `DepartmentQueue.tsx`'s row filter narrows what a given user's browser
  chooses to show, matching `product-spec.md`'s "a department member sees
  only what is assigned to them" as a UX default — it is not a security
  boundary, and nothing server-side backs it yet.
- **Actor checks on complete and cancel remain unenforced.** The spec names
  "only the assignee may complete" and "the HOD can cancel"; neither
  `complete` nor `cancel` reads an actor at all in this slice.
- **`assigneeId` is still unvalidated** — any non-empty string is accepted
  and stored, not checked against a real user or department membership.
- **No audit log.** A denied `403` is refused correctly and recorded
  nowhere.

---

## What this proves, and what it does not

**Proves.** The lifecycle from Week 2 survives a real database and a real
network. One authorization rule is enforced server-side, in one place, and
demonstrably refused when it should be. A write that loses a race is refused
distinctly from a write that was never legal. Four independent layers each
guard a boundary the others cannot see through.

**Does not prove.** Anything about identity, full role-based visibility, or
authorization on complete and cancel — each named above as still open, not
implemented and forgotten.
