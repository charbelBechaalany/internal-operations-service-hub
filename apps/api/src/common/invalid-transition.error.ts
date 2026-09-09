import { RequestAction } from '../requests/domain/request-action.enum';
import { RequestStatus } from '../requests/domain/request-status.enum';

/**
 * Thrown when the domain refuses a transition.
 *
 * This is a plain error, not a NestJS HttpException, so the domain and the
 * service stay free of framework types. The filter turns it into a response.
 */
export class InvalidTransitionError extends Error {
  constructor(
    readonly currentStatus: RequestStatus,
    readonly attemptedAction: RequestAction,
    message: string,
  ) {
    super(message);
    this.name = 'InvalidTransitionError';
  }
}