// Mirrors docs/api-contract.md §1 (the request shape) and §3 (error shapes).
// Nothing here is inferred — every field is one the contract names.

export type RequestStatus = 'Submitted' | 'Approved' | 'InProgress' | 'Completed' | 'Cancelled'

export interface RequestDto {
  id: string
  title: string
  description: string
  submittedAt: string
  requesterId: string
  departmentId: string
  status: RequestStatus
  assigneeId: string | null
  cancellationReason: string | null
  completedAt: string | null
  version: number
}

export interface CreateRequestInput {
  title: string
  description: string
  departmentId: string
}

export interface AssignRequestInput {
  assigneeId: string
}

export interface CancelRequestInput {
  reason: string
}

export type AttemptedAction = 'Approve' | 'Assign' | 'Complete' | 'Cancel'

// One tag per error shape in the contract's §3. VALIDATION covers both 400
// causes (header missing, or a body field failing class-validator) — the
// `cause` field is what the UI uses to decide where to show it: a banner
// for a missing actor (nothing on the form caused it), inline per field
// for a body validation failure. class-validator's message is always an
// array, one entry per failed rule, so `messages` stays an array rather
// than being flattened — the create form maps each entry back to the field
// it names, using the exact strings docs/api-contract.md §2 documents.
export type ApiError =
  | { kind: 'VALIDATION'; cause: 'missing-actor'; message: string }
  | { kind: 'VALIDATION'; cause: 'body'; messages: string[] }
  | { kind: 'NOT_DEPARTMENT_HEAD'; message: string; requestId: string; departmentId: string }
  | { kind: 'REQUEST_NOT_FOUND'; message: string; requestId: string }
  | {
      kind: 'INVALID_TRANSITION'
      message: string
      currentStatus: RequestStatus
      attemptedAction: AttemptedAction
    }
  | { kind: 'REQUEST_CONFLICT'; message: string; requestId: string; currentState: RequestDto }

export class ApiRequestError extends Error {
  readonly error: ApiError

  constructor(error: ApiError) {
    super(error.kind === 'VALIDATION' && error.cause === 'body' ? error.messages.join(' ') : error.message)
    this.error = error
  }
}
