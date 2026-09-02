# Data Model: Internal Operations Service Hub

Companion to `product-spec.md` and `architecture.md`.

A data model is behaviour made durable. Everything here exists because the spec requires a behaviour that would not survive without it.

Not covered: table definitions, column types, migrations.

---

## 1. Domain

#### What deserves to be an entity

The test: does it have its own identity, its own lifecycle, or does more than one thing need to point at it? If not, it is an attribute.

**User.** Has identity. Has a lifecycle, since an account can be disabled. Referenced by requests and audit entries. Carries a department, and a flag for system administrator.

**Department.** Requests are raised against departments, never against people. So a department must be referenceable on its own. It points at its head.

**Topic.** Belongs to one department. Defines the fields a request needs. Carries the confidential flag. That flag alone earns it an entity, since confidentiality is a property of the topic, not a choice the requester makes.

**Request.** The core entity. Everything else serves it.

**Attachment.** A request can have several, and each has its own storage reference. The bytes live in file storage. The database holds the reference.

**AuditEntry.** Every recorded action: creation, approval, assignment, reassignment, reroute, cancellation, completion, and denied access. Append-only. A request has many, so it cannot be an attribute.

**Notification.** Has its own lifecycle: pending, sent, failed. That state changes independently of the request, and the spec requires it to be visible separately.

#### What is not an entity

**Status.** An attribute. Five fixed values, no data of its own.

**Department membership.** An attribute on User. The spec says an employee belongs to one department, so a reference is enough. A join table would model a many-to-many the product does not have.

**Head of department.** A reference on Department. One head per department, enforced by the shape rather than by a rule.

**Role.** Not modelled. Every employee can raise a request, so requester is not a role. Assignee is a fact on the request. Head is a reference on Department. Administrator is a flag on User. A Role table would model permissions that do not exist.

**Reasons for cancelling or rerouting.** Attributes of the audit entry that carried them.

#### Relationships

**User to Department.** Many to one. Every user belongs to one department.

**Department to User, as head.** One to one. A department has exactly one head, and that head is a user.

**Department to Topic.** One to many. A topic belongs to one department. The same label in two departments is two topics, since fields and confidentiality are defined per department.

**Department to Request.** One to many. A request has exactly one owning department at a time. Rerouting changes it.

**Topic to Request.** One to many, and optional. A request raised under "Other" has no topic and carries free text instead.

**User to Request, as requester.** One to many, and required. Never changes.

**User to Request, as assignee.** One to many, and optional. Null until assigned. Never more than one.

**Request to Attachment.** One to many. Added only at submission.

**Request to AuditEntry.** One to many, never fewer than one.

**Request to Notification.** One to many. Assignment creates one. Reassignment creates another.

#### Ownership

The architecture says the backend owns authorization. So ownership has to be readable from stored data, not inferred.

Three fields answer every permission question in the spec:

- **Requester** on the request. Lets a requester see their own and nothing else.
- **Department** on the request. Rerouting updates it. Combined with the head reference on Department, it answers whether the actor may approve or assign.
- **Assignee** on the request. Null until assigned.

No lookup is derived. Every check reads a stored field.

---

## 2. Lifecycle and Rules

#### State versus lifecycle

**State is now.** Current status, department, assignee. Stored on the request, because every queue view and every permission check reads them.

**Lifecycle is the journey.** Every transition, who caused it, when, and why. Stored as audit entries.

Both are kept. State alone loses the audit trail. Events alone mean replaying history to draw a queue.

#### Transitions

Every transition writes one audit entry. The state change and the entry save in one operation. So a status can never change without a matching record.

| From | To | Who |
|---|---|---|
| none | Submitted | Requester |
| Submitted | Approved | Head of owning department |
| Approved | In Progress | Head, assigning a member |
| In Progress | In Progress | Head, reassigning |
| Submitted | Submitted | Head, rerouting with a reason |
| In Progress | Completed | Assignee |
| any before Completed | Cancelled | Head, or requester while Submitted |

Reassignment and reroute do not change status. They change ownership. Recording them as entries rather than status changes keeps status meaning one thing.

#### Invariants

Rules that must stay true. Each one names where it lives.

**Database constraints**

- A request has one requester and one department. Neither can be null.
- A request has at most one assignee.
- Status is one of exactly five values.
- A topic belongs to one department.
- A department has exactly one head.

**Domain logic**

- A status change and its audit entry save together, or neither saves.
- A request cannot be assigned before it is approved.
- Completed and Cancelled are final.
- The assignee must belong to the owning department.
- The topic must belong to the department the request was raised against.
- A submitted request has no update path. Its content is fixed.
- Audit entries are only ever inserted, never changed.

**Authorization**

- Only the head of the owning department may approve, assign, reassign, or reroute.
- Only the assignee may complete.
- A requester may cancel only while the request is Submitted.
- A confidential request is visible only to the head and the assignee.

#### Why the layer matters

**Database constraints** cover the shape of one row or one link. Strongest guarantee, since nothing bypasses them. Blind to time, to the actor, and to anything spanning entities.

**Domain logic** covers sequence, several entities together, and several writes belonging to one operation. Weaker, since it only holds if every path goes through it. That is why the architecture keeps the lifecycle in one service.

**Authorization** covers who is acting. Cannot be a constraint, since the database does not know the user. Checked before data is fetched, never after. A confidential request is excluded from the query, not filtered from the result.

Putting a rule in the wrong layer is the usual failure. "Only the head can approve" cannot be a constraint. "Status is one of five values" should not be left to code.

---

## 3. Storage

**Problem.** Where to store users, departments, topics, requests, audit entries, notifications, and attachment references.

**Options.** Relational, or document store.

**Decision.** Relational.

**Why.**

*Relationships.* Nearly everything here is one. Requests point at users, departments, and topics. Audit entries point back. A document store would duplicate this or rebuild the joins in code.

*Consistency.* The most important operation writes a status change, an audit entry, and a notification together. All three land or none do. That is a transaction across entities.

*Queries.* Every real query filters and joins. All are natural relationally.

*Variability.* The only argument the other way. Form fields differ per topic, so submitted values have no fixed shape. One field against relationships and transactions everywhere else.

**Consequence.** Schema changes need migrations. The variable form values are stored as a structured value on the request and validated by domain logic against the topic, not by the database. That is the one place the model gives up a database guarantee. It is contained.

#### Durable versus derived

**Stored, even though it could be computed:**

- Current status, department, and assignee. Read by every queue view and every permission check. Replaying events per read is the wrong cost.
- Original submission time. Rerouting must not change it, since reporting must show when the employee actually asked.
- Completion time. Reporting depends on it.
- Notification delivery state. Visible on the request, and changes independently.

**Not stored:**

- Department figures. Queries over stored data. Storing them creates a second truth that drifts. If they slow down, the architecture already names precomputed summaries as the answer.
- How long a request has been open. A function of a timestamp and the current time. Storing it means storing something wrong a second later.
- Whether a user may see a request. Evaluated per request. A stale permission is a security bug, not a display bug.

---

## 4. Access

#### Access patterns

The queries the product needs, from the spec. Not hypothetical reporting.

- **Requester's own list.** Filtered by requester, newest first. Run by every employee, constantly.
- **Department queue.** Filtered by department and status, then by topic, assignee, or age. Run by every head, many times a day. Grows fastest with volume.
- **Assignee's work list.** Filtered by assignee and open status. Run by every department member.
- **One request.** Fetched by identifier. Run on every navigation.
- **A request's history.** Audit entries for one request, in order. Run whenever a request opens.
- **Pending notifications.** Records due for a send attempt. Run continuously by the worker, with nobody waiting.
- **Department figures.** Aggregates grouped by topic and status. Run occasionally. The only query touching the full retention window.

#### Indexes

An index speeds one lookup, paid for in storage and slower writes. Each names the query it serves.

- **Request by requester.** Serves the requester's own list. Without it, finding one person's requests scans all of them.
- **Request by department and status.** Serves the department queue. Combined, because the queue always filters on both.
- **Request by assignee.** Serves the work list. Separate, because that list is not filtered by department.
- **AuditEntry by request.** Serves the history view, which runs on every request opened.
- **Notification by state.** Serves the worker. Narrow, because the worker only ever asks for one state.
- **User by department.** Serves listing department members when assigning.

**Not indexed, on purpose:**

- **Topic on Request.** The department index already narrows the queue. This would pay for a filter already served.
- **Audit entries beyond the request index.** Written constantly, read almost never, and those reads are investigations rather than features. Indexing would tax every write.
- **Anything for reporting.** Occasional, broad, and already named in the architecture as the thing to fix with precomputed summaries when history makes it slow. Indexing an unmeasured query is guessing.

Every index above names a query from the section before it. That is the test.

---

## 5. Traceability

| Model decision | Comes from |
|---|---|
| One audit entity, append-only | The audit log records who acted, when, and why, and cannot be edited |
| Status, department, assignee stored on the request | Queue views and permission checks read them constantly |
| Original submission time kept separately | Reporting must show when the employee actually asked |
| Notification as its own entity | Delivery state is visible separately from the work |
| Confidential flag on Topic | Visibility can be expressed in the query, not applied after fetching |
| No update path for request content | A submitted request is a fixed record |
| Department reference on User, head reference on Department | One department per employee, one head per department |
| Relational storage | Relationships everywhere, and one operation writing three things atomically |
| Six indexes | Each pays for a query the spec requires |

#### What would change this model

- **Comments get added.** A new entity with its own lifecycle, and the request stops being fixed. The largest change of any open question.
- **Automatic assignment gets added.** An assignment rule becomes an entity owned by a department, and the audit entry records whether it was automatic.
- **Approval from another department gets added.** Approval stops being one entry and becomes something with its own state.
- **Multiple assignees get allowed.** The assignee reference becomes a join, and the single-assignee invariant leaves the model.
- **An employee belongs to two departments.** The department reference on User becomes a join table. This is the change I judged least likely, and the reason Membership is not modelled today.