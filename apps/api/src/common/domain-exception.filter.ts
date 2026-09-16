import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

import { InvalidTransitionError } from './invalid-transition.error';
import { NotDepartmentHeadError } from './not-department-head.error';
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
 */
@Catch(InvalidTransitionError, RequestNotFoundError, NotDepartmentHeadError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(
    error: InvalidTransitionError | RequestNotFoundError | NotDepartmentHeadError,
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

    return response.status(HttpStatus.CONFLICT).json({
      error: 'INVALID_TRANSITION',
      message: error.message,
      currentStatus: error.currentStatus,
      attemptedAction: error.attemptedAction,
    });
  }
}