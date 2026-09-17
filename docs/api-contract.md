# API Contract: Internal Operations Service Hub

Companion to `product-spec.md`, `architecture.md`, and `data-model.md`. Documents what `apps/api/src/requests` actually accepts and returns today, derived from `requests.controller.ts`, its DTOs, `domain-exception.filter.ts`, `actor-id.decorator.ts`, and the four error classes in `common/`. Where the code does less than the spec describes, that is stated, not smoothed over.

Not covered: departments and users. Neither module exposes a controller yet, so there is no HTTP contract for them to document.

---

## 1. Conventions

**Base path.** `/requests`.

**Body encoding.** Every endpoint that reads a body expects `Content-Type: application/json`.

**Actor identity.** Three endpoints — create, approve, assign — read the caller's id from the `X-User-Id` header via the `ActorId` decorator. A missing or blank header is rejected before any domain code runs. Two endpoints — complete and cancel — do not use this decorator at all: the controller methods take no actor parameter, so no header is read and no authorization check runs. That is a fact about the code as it stands today, not a design endorsement; `product-spec.md` describes "only the assignee may complete" and "the HOD can cancel," and `data-model.md` lists both as authorization rules, but nothing in `requests.controller.ts` or `requests.service.ts` enforces them yet.

**Unknown body fields.** The global `ValidationPipe` (`main.ts`) is configured with `whitelist: true` and `forbidNonWhitelisted: true`. A field a DTO does not declare — `status`, `requesterId`, `version`, anything — is rejected, not silently dropped.

**The request shape.** Every success response, and `REQUEST_CONFLICT`'s `currentState`, is this shape:

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `title` | string | Set once, at creation. |
| `description` | string | Set once, at creation. |
| `submittedAt` | string (ISO datetime) | Never changes, including on reroute — not that reroute exists yet. |
| `requesterId` | string | The `X-User-Id` that created it. |
| `departmentId` | string | |
| `status` | `"Submitted" \| "Approved" \| "InProgress" \| "Completed" \| "Cancelled"` | |
| `assigneeId` | string \| null | Null until assigned. |
| `cancellationReason` | string \| null | Null unless cancelled. |
| `completedAt` | string (ISO datetime) \| null | Null until completed. |
| `version` | number | The version now stored, on every response, success or conflict. |

**`version` always reflects what is stored.** Every success response — including create, approve, assign, complete, and cancel — carries the version the write actually produced, not the version it started from. `TypeOrmRequestsRepository.save()` writes the persisted version back onto the record before returning, so the object every endpoint sends back matches a `GET` of the same row taken immediately after. `REQUEST_CONFLICT`'s `currentState.version` is likewise the true current version, since it comes from a fresh read after the conflicting write. No endpoint asks the client to send a version back — the check is entirely server-side — but a client that stores the version from any response and expects it to still be current the next time it reads that field is not relying on anything false.

**Visibility.** `GET /requests` and `GET /requests/:id` require no header and apply no filtering — every request is visible to every caller. `product-spec.md`'s "a requester sees only their own requests" role-based visibility is not implemented in this slice.

---

## 2. Endpoints

| Method | Path | Header required | Body |
|---|---|---|---|
| POST | `/requests` | `X-User-Id` | `CreateRequestDto` |
| GET | `/requests` | — | — |
| GET | `/requests/:id` | — | — |
| POST | `/requests/:id/approve` | `X-User-Id` | — |
| POST | `/requests/:id/assign` | `X-User-Id` | `AssignRequestDto` |
| POST | `/requests/:id/complete` | — | — |
| POST | `/requests/:id/cancel` | — | `CancelRequestDto` |

### POST /requests

Creates a request. Not a transition — there is no prior state — so it does not go through `applyTransition` and cannot produce `INVALID_TRANSITION` or `REQUEST_CONFLICT`.

**Header.** `X-User-Id` — becomes `requesterId`.

**Body** (`CreateRequestDto`, all required, extra fields rejected):

| Field | Rule | Message on failure |
|---|---|---|
| `title` | string, non-empty, ≤200 chars | "A request must have a title." |
| `description` | string, non-empty, ≤5000 chars | "A request must have a description." |
| `departmentId` | string, non-empty | "A request must have an owning department." |

**Success.** `201 Created`. Body: the new request, `status: "Submitted"`, `assigneeId: null`, `cancellationReason: null`, `completedAt: null`, `version: 1`.

**Errors.**
- `400` — missing/blank `X-User-Id`, or a body field fails validation, or the body carries a field the DTO doesn't declare.

Nothing checks that `departmentId` names a real department. An id for a department that doesn't exist is accepted by the DTO and only fails, uncaught by `DomainExceptionFilter`, at the database's foreign-key constraint — outside this contract's defined error shapes.

### GET /requests

**Header.** None.

**Success.** `200 OK`. Body: an array of every request, in the shape above, no filtering.

**Errors.** None.

### GET /requests/:id

**Header.** None.

**Success.** `200 OK`. Body: the request.

**Errors.**
- `404 REQUEST_NOT_FOUND` — no request with that id.

### POST /requests/:id/approve

Moves `Submitted` → `Approved`. Checks run in this order: the request exists, the caller is the head of its department, the move is legal, the write doesn't lose a race.

**Header.** `X-User-Id`.

**Body.** None read.

**Success.** `200 OK`. Body: the approved request (`status: "Approved"`).

**Errors, in the order the code can produce them:**
- `400` — missing/blank `X-User-Id`.
- `404 REQUEST_NOT_FOUND` — no request with that id.
- `403 NOT_DEPARTMENT_HEAD` — the caller is not `headId` of the request's department.
- `409 INVALID_TRANSITION` — status is not `Submitted` (already `Approved`, or terminal).
- `409 REQUEST_CONFLICT` — someone else's write landed between this request's read and its write.

### POST /requests/:id/assign

Moves `Approved` → `InProgress`, or `InProgress` → `InProgress` (reassignment — same action, since the data model treats reassignment as a change of owner, not of state). Same check order as approve.

**Header.** `X-User-Id`.

**Body** (`AssignRequestDto`):

| Field | Rule | Message on failure |
|---|---|---|
| `assigneeId` | string, non-empty | "An assignment must name an assignee." |

Nothing verifies `assigneeId` is a real user or a member of the request's department. `data-model.md` names that as a domain-logic invariant; this endpoint does not enforce it — any non-empty string is accepted and stored.

**Success.** `200 OK`. Body: the request with `status: "InProgress"` and `assigneeId` set to what was sent.

**Errors, in order:**
- `400` — missing/blank `X-User-Id`, or `assigneeId` missing/empty, or an extra body field.
- `404 REQUEST_NOT_FOUND`.
- `403 NOT_DEPARTMENT_HEAD`.
- `409 INVALID_TRANSITION` — status is `Submitted` (not yet approved) or terminal.
- `409 REQUEST_CONFLICT` — lost the race.

### POST /requests/:id/complete

Moves `InProgress` → `Completed`. No actor parameter exists on this handler — see the header note in §1. Runs no authorization check at all.

**Header.** None.

**Body.** None read.

**Success.** `200 OK`. Body: the completed request, `completedAt` set to now.

**Errors:**
- `404 REQUEST_NOT_FOUND`.
- `409 INVALID_TRANSITION` — status is not `InProgress`.
- `409 REQUEST_CONFLICT` — lost the race.

### POST /requests/:id/cancel

Moves any non-terminal status → `Cancelled`. No actor parameter on this handler either — no header, no authorization check. `product-spec.md`'s "a requester can cancel their own request only while Submitted" and "the HOD can cancel at any point" are both unenforced here: anyone who can reach the endpoint can cancel a request in any non-terminal status.

**Header.** None.

**Body** (`CancelRequestDto`):

| Field | Rule | Message on failure |
|---|---|---|
| `reason` | string, non-empty, ≤1000 chars | "A cancellation must record a reason." |

**Success.** `200 OK`. Body: the cancelled request, `cancellationReason` set to what was sent.

**Errors:**
- `400` — `reason` missing/empty/too long, or an extra body field.
- `404 REQUEST_NOT_FOUND`.
- `409 INVALID_TRANSITION` — status is already `Completed` or `Cancelled`.
- `409 REQUEST_CONFLICT` — lost the race.

---

## 3. Error shapes

Every domain error below is thrown as a plain `Error` subclass and turned into a response by `DomainExceptionFilter`, the one place that maps a domain error to HTTP. `400`s never reach that filter — they come from Nest's `ValidationPipe` or from `BadRequestException` thrown directly by the `ActorId` decorator, both using Nest's default exception shape, not the app's.

#### 400 — validation, or a missing actor header

Not a custom error class — Nest's built-in `BadRequestException` shape:

```
{ "statusCode": 400, "message": string | string[], "error": "Bad Request" }
```

Two distinct causes produce it:
- The `X-User-Id` header is missing or blank. `message` is exactly `"The X-User-Id header is required."`, from `actor-id.decorator.ts`.
- The request body fails `class-validator` rules, or carries a field its DTO doesn't declare. `message` is an array, one entry per failed rule.

A client sees this before any domain logic runs — before the request is even looked up.

#### 403 — NOT_DEPARTMENT_HEAD

```
{
  "error": "NOT_DEPARTMENT_HEAD",
  "message": string,
  "requestId": string,
  "departmentId": string
}
```

Thrown by `assertIsDepartmentHead` in `requests.service.ts`, used only by approve and assign. Means: the request exists, but the caller (`X-User-Id`) is not the `headId` of `departmentId`. The body deliberately withholds the real `headId` — a denied caller should not learn who the head is by probing requests they don't own. `requestId` and `departmentId` are already visible to any caller who can reach this endpoint, so nothing new is exposed by including them.

#### 404 — REQUEST_NOT_FOUND

```
{
  "error": "REQUEST_NOT_FOUND",
  "message": string,
  "requestId": string
}
```

Thrown whenever `id` doesn't match a stored request — on `GET /requests/:id` and at the start of every action. A client sees this for a typo'd id, a deleted-in-some-future-version request, or any id that never existed.

#### 409 — INVALID_TRANSITION

```
{
  "error": "INVALID_TRANSITION",
  "message": string,
  "currentStatus": "Submitted" | "Approved" | "InProgress" | "Completed" | "Cancelled",
  "attemptedAction": "Approve" | "Assign" | "Complete" | "Cancel"
}
```

Thrown when `resolveTransition(currentStatus, attemptedAction)` in `domain/transitions.ts` finds no matching row in its transition table — the move is not in the fixed set the lifecycle allows. `message` is generated by `explainRefusal`, e.g. `"A request cannot be assigned before it has been approved."` for assigning a `Submitted` request, or `"A request that is Completed is final and cannot be changed."` for anything attempted on a terminal request.

#### 409 — REQUEST_CONFLICT

```
{
  "error": "REQUEST_CONFLICT",
  "message": string,
  "requestId": string,
  "currentState": { ...the full request shape from §1... }
}
```

Thrown by `applyTransition` in `requests.service.ts` when the repository's conditional write affects zero rows: the version this action read no longer matches what's stored, because another write committed first. `currentState` is a fresh read taken after the conflict, so it carries the true current row — the same shape `GET /requests/:id` returns, chosen specifically so a client already holding that shape can swap it in without parsing a second one.

#### The two 409s are not the same failure

**`INVALID_TRANSITION` means the move is illegal no matter who asked or when.** `resolveTransition` has no entry for it — assigning a `Submitted` request, completing anything but `InProgress`, acting on `Completed` or `Cancelled` at all. Retrying the identical request will never succeed; the client needs a different action, not another attempt.

**`REQUEST_CONFLICT` means the move was legal against the state the actor read — it just lost the race to reach storage first.** The example the architecture doc names: a HOD assigns a request that was just cancelled or reassigned by someone else. Retrying blindly would silently overwrite that other write, which is exactly what this mechanism exists to prevent. The right client response is to look at `currentState` — already provided, no extra fetch needed — and decide whether the original action still makes sense against what's actually true now, not to resubmit the same request unchanged.

A client that treats both as "409, refuse and complain" loses the distinction the API is making on purpose: one says *stop*, the other says *look again*.
