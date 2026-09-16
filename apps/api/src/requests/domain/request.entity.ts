import { RequestStatus } from './request-status.enum';

/**
 * A request as the system stores it.
 *
 * Status and assignee are stored directly rather than derived, because the
 * data model treats the current state as durable: every read of a request
 * needs it.
 *
 * submittedAt never changes, since the specification requires reporting to
 * reflect when the employee actually asked.
 *
 * The content fields are readonly. A submitted request is a fixed record, so
 * the type itself gives no way to edit it.
 *
 * requesterId is readonly too: the data model says the requester never
 * changes, unlike department and assignee.
 *
 * departmentId is mutable rather than readonly: the data model says
 * rerouting changes the owning department later, even though nothing in
 * this slice exercises that yet. Marking it readonly now would misstate the
 * entity and force a breaking change when reroute is implemented.
 *
 * version exists for optimistic locking but is not yet enforced: the
 * repository advances it on every save, and nothing reads it back to reject
 * a stale write. That check is a separate, later change. A record not yet
 * persisted carries 0; the first save stores it as 1.
 */
export interface RequestRecord {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly submittedAt: Date;
  readonly requesterId: string;

  departmentId: string;
  status: RequestStatus;
  assigneeId: string | null;
  cancellationReason: string | null;
  completedAt: Date | null;
  version: number;
}