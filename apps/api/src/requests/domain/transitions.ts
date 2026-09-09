import { RequestAction } from './request-action.enum';
import { RequestStatus, isTerminal } from './request-status.enum';

/**
 * The legal transitions, taken directly from the data model.
 *
 * A transition that is not in this table does not exist. That is what makes
 * "Submitted cannot go straight to Completed" structural rather than a check
 * somebody might forget to write.
 *
 * Assign appears twice: from Approved it starts the work, and from InProgress
 * it reassigns. Reassignment changes who holds the request without changing
 * its status, which is why both entries produce InProgress.
 */
interface Transition {
  readonly from: RequestStatus;
  readonly action: RequestAction;
  readonly to: RequestStatus;
}

const TRANSITIONS: readonly Transition[] = [
  { from: RequestStatus.Submitted, action: RequestAction.Approve, to: RequestStatus.Approved },
  { from: RequestStatus.Approved, action: RequestAction.Assign, to: RequestStatus.InProgress },
  { from: RequestStatus.InProgress, action: RequestAction.Assign, to: RequestStatus.InProgress },
  { from: RequestStatus.InProgress, action: RequestAction.Complete, to: RequestStatus.Completed },
  { from: RequestStatus.Submitted, action: RequestAction.Cancel, to: RequestStatus.Cancelled },
  { from: RequestStatus.Approved, action: RequestAction.Cancel, to: RequestStatus.Cancelled },
  { from: RequestStatus.InProgress, action: RequestAction.Cancel, to: RequestStatus.Cancelled },
];

/**
 * Returns the state this action produces, or null if the move is not legal.
 */
export function resolveTransition(
  from: RequestStatus,
  action: RequestAction,
): RequestStatus | null {
  const match = TRANSITIONS.find((t) => t.from === from && t.action === action);
  return match ? match.to : null;
}

/**
 * Explains why a move was refused, so the API can tell the caller what
 * happened and what to do next rather than returning a generic error.
 */
export function explainRefusal(from: RequestStatus, action: RequestAction): string {
  if (isTerminal(from)) {
    return `A request that is ${from} is final and cannot be changed.`;
  }

  if (action === RequestAction.Assign && from === RequestStatus.Submitted) {
    return 'A request cannot be assigned before it has been approved.';
  }

  if (action === RequestAction.Complete && from === RequestStatus.Submitted) {
    return 'A request cannot be completed before it has been approved and assigned.';
  }

  if (action === RequestAction.Complete && from === RequestStatus.Approved) {
    return 'A request cannot be completed before it has been assigned.';
  }

  if (action === RequestAction.Approve && from === RequestStatus.Approved) {
    return 'This request has already been approved.';
  }

  return `A request that is ${from} cannot accept the action ${action}.`;
}