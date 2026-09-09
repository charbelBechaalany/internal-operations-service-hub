/**
 * Thrown when a request id does not exist.
 *
 * Separate from a refused transition, because "this request cannot move" and
 * "this request does not exist" are different answers and deserve different
 * status codes.
 */
export class RequestNotFoundError extends Error {
  constructor(readonly requestId: string) {
    super(`No request exists with id ${requestId}.`);
    this.name = 'RequestNotFoundError';
  }
}