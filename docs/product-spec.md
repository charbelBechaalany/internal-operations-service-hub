# Product Specification: Internal Operations Service Hub

#### Problem / Context

Employees across the company need help from internal departments such as IT (Information Technology), HR (Human Resources), Finance, and Facilities. Today there is no system that records those requests, routes them to an owner, or tracks them to completion. Requests move through personal email, chat messages, corridor conversations, and ad hoc spreadsheets.

This causes a set of predictable failures. Requests are forgotten because nothing records them. Requesters cannot tell whether their request was received or who is handling it, so they chase status manually and consume the department's time doing it. Work lands on whoever happened to be asked directly rather than on whoever should own it, which leaves heads of department unable to distribute work deliberately. A request sent to the wrong department dies there and has to be raised again from scratch. And because nothing is measured, a head of department has no view of how much work their team is carrying or where the recurring demand comes from.

The product is a centralized internal service hub, similar in structure to an issue tracker but built around help requests rather than project tasks. An employee raises a request against a department. The head of that department reviews it, approves it, and assigns it to a member of the team. The requester follows a single status from submission to completion.

Success for the first version means every internal help request in the four departments in scope is raised, owned, and closed inside one system, with the requester able to see its state at any moment without asking anyone.

---

#### Known Facts

These are verified starting points rather than assumptions, and the design is built on them.

* The company is organized into departments that receive help requests from employees. IT, HR, Finance, and Facilities are in scope for the first version.
* Each of these departments has a HOD (Head of Department) who receives incoming requests, decides whether they proceed, and assigns them to a member of the team.
* A HOD can reassign a request to a different member of their own department, or reroute it to another department when it arrives in the wrong place.
* Requests are raised against a department, never against a named individual. The requester does not choose who does the work.
* Requests follow a fixed lifecycle: Submitted, then Approved, then In Progress, then Completed. A request can be Cancelled at any point before completion.
* A request becomes In Progress only once it has been approved and assigned to a specific person.
* Some requests fall into recurring topics such as password reset or equipment request. Others fit no topic and have to be described by the requester in free text.
* The system is built from scratch and integrates with no existing company system. It therefore owns its own user records, holding each employee's identity, work email address, and department membership.
* Every employee has a work email address recorded in the system, and email is the only channel guaranteed to reach everyone.
* Email works as a one-way notification channel. A request cannot be created or progressed from an email, so all work happens inside the application.
* Departments currently have no shared queue and work from individual inboxes.

---

#### Actors / Stakeholders

**Requester.** Any employee who needs help. Raises a request and follows its status. Sees only their own requests.

**HOD (Head of Department).** The single entry point for everything a department receives. Approves submitted requests, cancels those that should not proceed, assigns and reassigns work within the department, and reroutes misdirected requests elsewhere. Also defines which request topics the department accepts. Sees the full department queue.

**Assignee.** A department member who has been given a request. Works on it and reports it complete. Sees the requests assigned to them.

**System Administrator.** Configures the structure of the system: creates departments, designates heads of department, defines who belongs to each department, and manages roles.


---

#### Functional Requirements

**Raising a request**

* A requester raises a request by selecting a department and a request topic, then filling the form defined for that topic.
* Where no topic fits, the requester selects "Other" and describes the request in free text.
* A requester can attach files to a request at the moment of submission.
* Once submitted, a request is fixed. Neither the requester nor the assignee can edit its content or add to it. Anything missing is handled outside the system, and if the request cannot proceed as written the HOD cancels it and the requester raises a corrected one.

**Lifecycle and status**

* A new request enters status Submitted and appears in the receiving department's queue.
* The HOD approves a submitted request, moving it to Approved, or cancels it with a recorded reason.
* Assigning an approved request to a department member moves it to In Progress and records that person as the assignee.
* The assignee sets the request to Completed when the work is finished, and the completion time is recorded for reporting.
* The HOD can cancel a request at any point before completion. A requester can cancel their own request only while it is still Submitted.
* Completed and Cancelled are final. The system rejects any attempt to move a request out of either state.
* A request can only be assigned once it has been approved. Assignment attempted on a submitted request is rejected, and the HOD is prompted to approve it first.
* The current status, assignee, and full history of a request are visible to the requester at all times.

**Assignment and routing**

* The HOD assigns an approved request to any member of their department.
* The HOD can reassign an in-progress request to a different member of the same department, keeping status, attachments, and history intact.
* The HOD can reroute a request to another department, where it enters the queue as Submitted. The original submission time is kept so reporting reflects when the employee actually asked.
* A request is owned by exactly one department, and once assigned, by exactly one person at a time.

**Notification**

* When a request is assigned, the assignee receives an email containing the requester's name, the request description, and a direct link to the request.
* Notification emails are outbound only. Replies do not reach the system and do not update the request.
* Every notification carries a delivery state of its own, visible on the request as sent, pending, or failed. The assignee and the HOD can therefore see whether the email actually reached its destination rather than assuming it did.

**Behaviour when something goes wrong**

The system is designed so that a failure in a supporting service never becomes a failure of the work itself. The following cases are handled explicitly rather than left to chance.

* *A notification email cannot be delivered.* The action that triggered it still succeeds and remains fully visible in the application. The message is queued and retried on a backoff schedule. If it still fails after the retry window, the notification is marked failed on the request, the HOD sees that the assignee was never reached and can follow up directly, and the failure is reported to system administrators. Work is never blocked waiting on email.
* *A submission does not complete.* If a request cannot be saved, the requester is shown a clear error and their entered content is preserved on the form so nothing has to be retyped. A request is either created and visible, or it visibly failed. There is no silent loss.
* *A user attempts an action their role does not permit.* The action is refused, no protected content appears anywhere in the response, and the attempt is recorded in the audit log. This applies equally to opening a request by its direct link and to attempting a status change from a role that does not own it.
* *An invalid status change is attempted.* The system enforces the lifecycle rather than trusting the interface. Any transition outside the defined sequence, including anything out of Completed or Cancelled, is rejected with an explanation of why.
* *Two people act on the same request at once.* If a HOD assigns a request that has just been cancelled or reassigned by someone else, the second action is rejected and the actor is shown the current state rather than silently overwriting it.

**Configuration and reporting**

* A system administrator creates departments, designates a head for each, and defines department membership.
* A HOD defines the request topics their department accepts and the fields each topic requires.
* A HOD views the department queue, filterable by status, topic, assignee, and age, along with department figures covering open volume, average time to completion, and volume by topic.
* An assignee views a personal list of the requests currently assigned to them.

---

#### Non-Functional Requirements

**Security and access**

* The system authenticates users against its own account records. Passwords are never stored in readable form, sessions expire after a period of inactivity, and an account can be disabled by an administrator so that access ends immediately.
* Visibility follows role. A requester sees only their own requests, a department member sees only what is assigned to them, and a HOD sees the full department queue.
* A request topic can be flagged confidential, for example an HR grievance. Such a request is visible only to the HOD and the assignee, is left out of the general department queue, and does not appear in other members' searches.
* Every status change, assignment, reroute, cancellation, and denied access attempt is written to an audit log that cannot be edited, recording who acted, when, and why where a reason applies.

**Performance and availability**

* Request list and detail views load within two seconds under normal load.
* The system supports the full employee headcount, with a design peak of 200 users active at the same time.
* Availability target of 99.5% during business hours.
* Notification emails are sent within 60 seconds of the event that triggers them, and retried for up to 24 hours before being marked failed.

**Reliability**

* Email is a secondary channel, so a failure in email delivery must never block work inside the application.
* No submitted request is silently lost. Submission either succeeds and produces a visible request, or fails with a clear error to the requester.
* The application remains usable when the email service is unavailable, with only notification delivery degraded.

**Usability**

* The requester interface must be usable without training, and raising a request should take under two minutes.
* Because a request cannot be edited after submission, the form must make the required detail obvious before the requester submits it.
* Every refusal, whether a permission denial, an invalid status change, or a failed submission, must tell the user what happened and what to do next rather than showing a generic error.
* The interface works fully on mobile browsers.
* Status and current assignee must be readable at a glance, without opening the history.

**Data**

* Requests and their history are kept for a configurable period, defaulting to three years, to satisfy internal audit needs.

---

#### Assumptions, Constraints & Unknowns

**Assumptions**

Taken as true without verification. Each one carries a consequence if it turns out to be wrong.

* Every department in scope has a designated head with the authority to approve and assign. Without one, the lifecycle stalls at Submitted with nobody to move it.
* That head has the availability to triage everything the department receives. If not, manual triage becomes the bottleneck and automatic assignment moves from a deferral into a launch requirement.
* The HOD is the only approval needed, and no request requires sign-off from outside the receiving department. If that is wrong, a second approval step changes the lifecycle significantly.
* One assignee per request is enough, since requests are discrete pieces of work one person can own even when they informally consult colleagues.
* A well designed topic form captures enough detail that most requests can proceed without follow-up questions. This is what makes a fixed, uneditable request workable, and it is the assumption most likely to be tested in practice.
* Where follow-up is genuinely needed, the assignee can reach the requester directly by email or phone using the contact details in the notification. The system records the outcome of the work, not the conversation around it.
* Heads of department are willing to define their own topics rather than accept a list imposed centrally.
* Department membership and company structure are stable enough that routing does not need frequent reconfiguration.
* An administrator maintains user accounts and department membership inside the system. Because the system owns this data rather than reading it from a company directory, joiners, leavers, and transfers depend on that administrator acting, and a departing employee retains access until their account is disabled.
* The company's email service is reliable enough that failed delivery is an exception to be handled rather than a routine occurrence. If it turns out to be common, an in-application notification centre becomes necessary rather than optional.
* Employees will adopt the system if raising a request is faster than writing an email. This is the largest product risk, because it holds regardless of how well the functionality works.

**Constraints**

Hard limits the design has to work within rather than negotiate.

* The system integrates with no existing company system. Identity, accounts, and department membership are owned and maintained inside the product.
* Confidential topics, particularly HR personnel matters, must follow the company's existing rules for handling employee records.
* The system routes and tracks requests. It is not a system of record and must not store HR records, financial data, or asset inventories.
* Inbound email cannot enforce required fields, permissions, or topic routing, which is why email stays outbound only.
* The first version must be deliverable by a small team, which limits how many departments, topics, and integrations can ship at launch.

**Unknowns**

Open questions that need answers from stakeholders before the affected scope can be estimated.

*Communication on a request.* The first version deliberately carries no comments and no chat, which makes a submitted request a fixed record. How often will an assignee genuinely need to go back to the requester before they can start? If the answer is often, a comment thread becomes necessary rather than optional. Beyond that sits the channel question: does the company use Microsoft Teams, and is it standard across every department and every type of employee, including staff without desks? If Teams is in use, does the company have the administrative approval and API (Application Programming Interface) access needed to deploy an application on it, and would that application carry notifications only or full request submission? There is also a build-or-integrate decision underneath. The system could connect to an existing chat platform, or implement its own chat inside each request. Integration depends on a platform the company may not have standardized on, while built-in chat is self-contained but duplicates a tool employees may already use.

*Automatic assignment.* Should a HOD be able to set rules so that requests under a given topic go automatically to a designated employee, skipping manual triage? Password resets going straight to the IT support specialist would be the obvious case. If that automation exists, does it also skip approval and move the request straight to In Progress, or does the head still approve first? Should it go further than topic rules into round-robin distribution or balancing by each member's open workload? And can the head override an automatic assignment afterwards, with the requester able to see whether assignment was automatic or manual?

*Assignment authority.* Can a department member reassign a request to a colleague directly, or must every reassignment pass through the head? Can an assignee decline a request, and if so does it return to the queue as Approved or go back to the head for a decision? Should a request ever carry more than one assignee where two people must work together? And what happens to a department's queue when the head is away, whether a deputy takes over or the queue simply waits?

*Notification scope and fallback.* The assignee is notified on assignment. Should the requester also be emailed on approval, assignment, completion, and cancellation, or is in-application status enough? Should the head be emailed when a new request arrives, or is checking the queue the expected behaviour? And when an email fails permanently, is marking it failed on the request sufficient, or does the company expect an alternative channel to be attempted?

*Workflow scope.* Are there request types that need approval from outside the receiving department, such as a purchase requiring Finance sign-off before IT acts? Should a requester be able to reopen a completed request when the problem persists, and within what window? Should cancellation stay available after approval, or only while the request is still Submitted? And should requests carry priority levels, set by either the requester or the head?

*Operations and reporting.* Which topics carry the highest volume and should be configured first? Do departments have SLA (Service Level Agreement) expectations, and does any of them measure resolution time today? Do they run existing tools, such as an IT ticketing system or an HR portal, that this must replace, sit alongside, or import from? What weekly volume should the architecture be sized for? Who owns configuration after launch, a central team or each head of department? And does a different retention period apply to confidential HR requests than the three-year default?

---

#### Non-Goals


* Comments on a request. A submitted request is a fixed record. Neither the requester nor the assignee can add to it, and any clarification happens outside the system.
* Editing a request after submission. A request that was raised incorrectly is cancelled and raised again rather than amended, which keeps the record straightforward and the audit trail clean.
* Chat platform integration or built-in real-time chat. The channel question is unresolved, and this stays out until it is settled.
* Creating or acting on requests from email. Inbound email cannot enforce required fields, permissions, or routing, so email carries a notification and a link and nothing more.
* An in-application notification centre. Failed emails are visible on the request itself, but there is no separate inbox inside the product in the first version.
* Rule-based automatic assignment. Assignment is manual in the first version, deferred until real request patterns can be observed.
* Requester-selected assignees. Requests belong to departments, and the requester never picks an individual.
* Multi-department requests. A request is owned by one department at a time. It can be rerouted, not shared.
* Approval from outside the receiving department. The HOD is the only approver for now.
* Reopening completed requests. Completed is final in the first version, and a recurring problem is raised as a new request.
* Integration with a central identity provider. Accounts live inside the system in the first version.

---

#### Acceptance Criteria

**Happy scenarios**

*A request is raised and reaches the right queue.*
Given an authenticated employee is on the request creation page, when they select the IT department, choose the topic "Laptop Replacement", fill the required fields, and submit, then the request is created with status Submitted, appears in the IT department queue within five seconds, and appears in the requester's own list with the same status.

*A request is approved and assigned.*
Given a request is in status Submitted and the Head of IT opens it, when they approve it and assign it to a department member, then the status becomes In Progress, the assignee is recorded and shown to the requester, and that assignee receives an email within 60 seconds containing the requester's name, the request description, and a direct link to the request.

*A misdirected request is rerouted without losing its history.*
Given a request was raised against IT but is in fact an HR matter, when the Head of IT reroutes it to HR with a stated reason, then the request leaves the IT queue and enters the HR queue as Submitted, the full history including the reroute reason is kept, the original submission time is retained for reporting, and the requester sees HR as the owning department.

**Sad scenarios**

*A submitted request cannot be altered.*
Given a request has been submitted and is waiting in the department queue, when the requester or the assignee opens it and tries to change its description or add to it, then no editing is offered, the original content stays exactly as submitted, and the requester is told that a request needing changes must be cancelled and raised again.

*A notification email is never delivered.*
Given the email service accepts an assignment notification but delivery fails permanently, when the retry window of 24 hours expires without success, then the request stays In Progress and fully workable in the application, the notification is marked failed on the request, the Head of Department sees that the assignee was never reached and can follow up directly, and the failure is reported to system administrators.

*A request is assigned before it has been approved.*
Given a request is still in status Submitted, when the Head of Department attempts to assign it to a member of the team, then the assignment is rejected, the status stays Submitted, no assignee is recorded, and the head is told the request must be approved before it can be assigned.

*A confidential request stays hidden from the rest of the department.*
Given an employee raises a request under a topic flagged confidential, such as an HR grievance, when another HR member who is not the assignee views the department queue or runs a search, then the request appears in neither result, and only the Head of HR and the assigned member can open it.

*Someone opens a request they have no right to see.*
Given an employee who is not the requester, not the assignee, and not the head of the owning department has a direct link to a request, when they open that link, then access is refused, no part of the request content appears in the response, and the attempt is recorded in the audit log with who tried and when.