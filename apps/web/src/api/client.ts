import {
  ApiRequestError,
  type ApiError,
  type AssignRequestInput,
  type CancelRequestInput,
  type CreateRequestInput,
  type RequestDto,
} from './types'

const BASE_URL = '/requests'

// Everything the contract calls a "plain Error subclass turned into a
// response by DomainExceptionFilter" carries an `error` discriminator.
// 400s don't come from that filter, so they're the shapeless Nest body
// instead — see docs/api-contract.md §3.
interface DomainErrorBody {
  error: 'NOT_DEPARTMENT_HEAD' | 'REQUEST_NOT_FOUND' | 'INVALID_TRANSITION' | 'REQUEST_CONFLICT'
  message: string
  [key: string]: unknown
}

interface NestValidationBody {
  statusCode: 400
  message: string | string[]
  error: 'Bad Request'
}

function toApiError(status: number, body: unknown): ApiError {
  if (status === 400) {
    const { message } = body as NestValidationBody
    // The header check throws a single string; class-validator always
    // throws an array, one entry per failed rule (contract §3).
    if (Array.isArray(message)) {
      return { kind: 'VALIDATION', cause: 'body', messages: message }
    }
    return { kind: 'VALIDATION', cause: 'missing-actor', message }
  }

  const domainBody = body as DomainErrorBody
  switch (domainBody.error) {
    case 'NOT_DEPARTMENT_HEAD':
      return {
        kind: 'NOT_DEPARTMENT_HEAD',
        message: domainBody.message,
        requestId: domainBody.requestId as string,
        departmentId: domainBody.departmentId as string,
      }
    case 'REQUEST_NOT_FOUND':
      return {
        kind: 'REQUEST_NOT_FOUND',
        message: domainBody.message,
        requestId: domainBody.requestId as string,
      }
    case 'INVALID_TRANSITION':
      return {
        kind: 'INVALID_TRANSITION',
        message: domainBody.message,
        currentStatus: domainBody.currentStatus as RequestDto['status'],
        attemptedAction: domainBody.attemptedAction as never,
      }
    case 'REQUEST_CONFLICT':
      return {
        kind: 'REQUEST_CONFLICT',
        message: domainBody.message,
        requestId: domainBody.requestId as string,
        currentState: domainBody.currentState as RequestDto,
      }
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })

  if (response.ok) {
    return (await response.json()) as T
  }

  const body = await response.json()
  throw new ApiRequestError(toApiError(response.status, body))
}

export function listRequests(): Promise<RequestDto[]> {
  return request<RequestDto[]>('', { method: 'GET' })
}

export function createRequest(actorId: string, input: CreateRequestInput): Promise<RequestDto> {
  return request<RequestDto>('', {
    method: 'POST',
    headers: { 'X-User-Id': actorId },
    body: JSON.stringify(input),
  })
}

export function approveRequest(actorId: string, requestId: string): Promise<RequestDto> {
  return request<RequestDto>(`/${requestId}/approve`, {
    method: 'POST',
    headers: { 'X-User-Id': actorId },
  })
}

export function assignRequest(
  actorId: string,
  requestId: string,
  input: AssignRequestInput,
): Promise<RequestDto> {
  return request<RequestDto>(`/${requestId}/assign`, {
    method: 'POST',
    headers: { 'X-User-Id': actorId },
    body: JSON.stringify(input),
  })
}

// No X-User-Id header on either of these two: the contract is explicit that
// complete and cancel read no actor at all (§1) — a fact about the API as
// it stands, not something this client should paper over by sending one.
export function completeRequest(requestId: string): Promise<RequestDto> {
  return request<RequestDto>(`/${requestId}/complete`, { method: 'POST' })
}

export function cancelRequest(requestId: string, input: CancelRequestInput): Promise<RequestDto> {
  return request<RequestDto>(`/${requestId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
