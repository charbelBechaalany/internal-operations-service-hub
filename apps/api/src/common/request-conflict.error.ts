import { RequestRecord } from '../requests/domain/request.entity';

/**
 * Thrown when a write loses an optimistic-concurrency race: the request was
 * cancelled, assigned, or otherwise changed by someone else between the
 * actor's read and their write.
 *
 * Separate from InvalidTransitionError, even though both are 409s: an invalid
 * transition is illegal regardless of timing (Submitted can never go straight
 * to Completed), while a conflict is a transition that would have been legal
 * against the state the actor saw, but lost the race to another write. The
 * distinction matters to the caller - one means "try a different action,"
 * the other means "look again and decide."
 *
 * Carries the full current record, not just a message, so the actor is shown
 * what is true rather than told only that something changed.
 */
export class RequestConflictError extends Error {
  constructor(
    readonly requestId: string,
    readonly currentState: RequestRecord,
  ) {
    super(`Request ${requestId} was changed by someone else. Showing its current state.`);
    this.name = 'RequestConflictError';
  }
}
