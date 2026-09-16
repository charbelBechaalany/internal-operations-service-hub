/**
 * Thrown when the acting user is not the head of the department that owns
 * the request.
 *
 * A plain Error, not a NestJS exception, for the same reason as
 * InvalidTransitionError and RequestNotFoundError: the service stays free of
 * framework types, and the filter is the one place that turns it into a
 * response.
 *
 * The body carries requestId and departmentId but not the actor id or the
 * department's actual headId. Both are already visible to any caller who can
 * reach this endpoint (departmentId via GET /requests/:id, requestId via the
 * URL they used), so nothing new is exposed. The real headId is withheld
 * deliberately: a denied caller should not be able to learn who the head is
 * by probing requests they don't own.
 */
export class NotDepartmentHeadError extends Error {
  constructor(
    readonly requestId: string,
    readonly departmentId: string,
  ) {
    super(`Only the head of department ${departmentId} may perform this action.`);
    this.name = 'NotDepartmentHeadError';
  }
}
