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
 */
export interface RequestRecord {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly submittedAt: Date;

  status: RequestStatus;
  assigneeId: string | null;
  cancellationReason: string | null;
  completedAt: Date | null;
}