import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

import { InvalidTransitionError } from './invalid-transition.error';
import { NotDepartmentHeadError } from './not-department-head.error';
import { RequestConflictError } from './request-conflict.error';
import { RequestNotFoundError } from './request-not-found.error';

/**
 * Maps domain errors to HTTP responses.
 *
 * This is the one place that knows about both the domain and HTTP. Keeping it
 * here is what lets the service throw meaningful errors without importing a
 * framework type.
 *
 * The specification requires every refusal to say what happened and what to do
 * next, which is why the body carries the current status and the attempted
 * action rather than just a message.
 *
 * INVALID_TRANSITION and REQUEST_CONFLICT are both 409s but distinct codes:
 * the first means the move is illegal no matter who asked or when; the
 * second means it was legal against what the actor saw, but someone else's
 * write got there first. A client needs to tell them apart - one calls for
 * a different action, the other for looking again.
 */
@Catch(InvalidTransitionError, RequestNotFoundError, NotDepartmentHeadError, RequestConflictError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(
    error: InvalidTransitionError | RequestNotFoundError | NotDepartmentHeadError | RequestConflictError,
    host: ArgumentsHost,
  ) {
    const response = host.switchToHttp().getResponse<Response>();

    if (error instanceof RequestNotFoundError) {
      return response.status(HttpStatus.NOT_FOUND).json({
        error: 'REQUEST_NOT_FOUND',
        message: error.message,
        requestId: error.requestId,
      });
    }

    if (error instanceof NotDepartmentHeadError) {
      return response.status(HttpStatus.FORBIDDEN).json({
        error: 'NOT_DEPARTMENT_HEAD',
        message: error.message,
        requestId: error.requestId,
        departmentId: error.departmentId,
      });
    }

    if (error instanceof RequestConflictError) {
      return response.status(HttpStatus.CONFLICT).json({
        error: 'REQUEST_CONFLICT',
        message: error.message,
        requestId: error.requestId,
        currentState: error.currentState,
      });
    }

    return response.status(HttpStatus.CONFLICT).json({
      error: 'INVALID_TRANSITION',
      message: error.message,
      currentStatus: error.currentStatus,
      attemptedAction: error.attemptedAction,
    });
  }
}