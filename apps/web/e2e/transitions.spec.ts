import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * Automates the twelve cases from docs/week2-agentic-workflow.md (six valid
 * transitions, six invalid ones) against the real, running API.
 *
 * Week 2 proved these by hand against a service with no identity concept:
 * every rejection was decided by state alone. Since then, approve and assign
 * gained an authorization check (assertIsDepartmentHead in
 * requests.service.ts), so every call now needs an X-User-Id header, and
 * every request needs a real, seeded department to be owned by. Both come
 * from the fixed seed rows in apps/api/src/database/seed.ts - the same ones
 * approve-authorization.spec.ts uses - which playwright.config.ts's `api`
 * webServer entry resets and reseeds once before this whole suite runs.
 * complete and cancel take no actor parameter at all (see requests.service.ts
 * and requests.controller.ts: neither handler has an @ActorId()), so those
 * two calls below carry no X-User-Id header - there is nothing to check.
 *
 * Isolation follows approve-authorization.spec.ts: no case touches the
 * seed's fixed request-it-1 row, because that row is shared by every test in
 * this run and never reset between them. Each case below mints its own
 * request through POST /requests and, where the table needs a request
 * already in some later state, drives it there with its own further calls
 * through the real API - never by writing state directly.
 *
 * Assertions check the status code and the `error` code from
 * DomainExceptionFilter, never the `message` prose, so a reworded refusal
 * does not break this suite.
 *
 * One consequence of adding the actor check: three of the six invalid cases
 * (assign-while-Submitted, approve-while-Approved, approve-while-Cancelled)
 * use Approve or Assign as the rejected action, and both of those actions
 * check authorization before they ever consult the transition table. Calling
 * them as anyone but the department head would return 403 NOT_DEPARTMENT_HEAD
 * without ever reaching the check this suite means to prove. So those three
 * cases deliberately act as IT_HEAD - the one actor who clears authorization
 * and reaches the transition table - so the 409 they assert on is actually
 * the invalid-transition refusal, not a masked authorization failure.
 */
const IT_DEPARTMENT = 'dept-it'
const IT_HEAD = 'user-it-head'
const IT_MEMBER_1 = 'user-it-member-1'
const IT_MEMBER_2 = 'user-it-member-2'
const REQUESTER = 'user-requester'

interface RequestBody {
  id: string
  status: string
  assigneeId: string | null
}

interface ErrorBody {
  error: string
}

async function createSubmittedRequest(request: APIRequestContext, title: string): Promise<RequestBody> {
  const response = await request.post('/requests', {
    headers: { 'X-User-Id': REQUESTER },
    data: {
      title,
      description: 'Created directly through the API by the transitions suite.',
      departmentId: IT_DEPARTMENT,
    },
  })
  expect(response.status(), `POST /requests failed: ${await response.text()}`).toBe(201)
  return (await response.json()) as RequestBody
}

function approve(request: APIRequestContext, id: string) {
  return request.post(`/requests/${id}/approve`, { headers: { 'X-User-Id': IT_HEAD } })
}

function assign(request: APIRequestContext, id: string, assigneeId: string) {
  return request.post(`/requests/${id}/assign`, {
    headers: { 'X-User-Id': IT_HEAD },
    data: { assigneeId },
  })
}

// No X-User-Id: complete has no actor check (requests.service.ts#complete).
function complete(request: APIRequestContext, id: string) {
  return request.post(`/requests/${id}/complete`)
}

// No X-User-Id: cancel has no actor check either (requests.service.ts#cancel).
function cancel(request: APIRequestContext, id: string, reason = 'no longer needed') {
  return request.post(`/requests/${id}/cancel`, { data: { reason } })
}

test.describe('valid transitions (docs/week2-agentic-workflow.md, Valid transitions table)', () => {
  test('1: create -> 201, Submitted', async ({ request }) => {
    const created = await createSubmittedRequest(request, `Valid 1 — ${test.info().testId}`)
    expect(created.status).toBe('Submitted')
  })

  test('2: approve from Submitted -> 200, Approved', async ({ request }) => {
    const created = await createSubmittedRequest(request, `Valid 2 — ${test.info().testId}`)

    const response = await approve(request, created.id)
    expect(response.status()).toBe(200)
    expect((await response.json()).status).toBe('Approved')
  })

  test('3: assign from Approved -> 200, InProgress', async ({ request }) => {
    const created = await createSubmittedRequest(request, `Valid 3 — ${test.info().testId}`)
    await approve(request, created.id)

    const response = await assign(request, created.id, IT_MEMBER_1)
    expect(response.status()).toBe(200)
    const body = (await response.json()) as RequestBody
    expect(body.status).toBe('InProgress')
    expect(body.assigneeId).toBe(IT_MEMBER_1)
  })

  test('4: reassign from InProgress -> 200, InProgress, assignee changed', async ({ request }) => {
    const created = await createSubmittedRequest(request, `Valid 4 — ${test.info().testId}`)
    await approve(request, created.id)
    await assign(request, created.id, IT_MEMBER_1)

    const response = await assign(request, created.id, IT_MEMBER_2)
    expect(response.status()).toBe(200)
    const body = (await response.json()) as RequestBody
    expect(body.status).toBe('InProgress')
    expect(body.assigneeId).toBe(IT_MEMBER_2)
  })

  test('5: complete from InProgress -> 200, Completed', async ({ request }) => {
    const created = await createSubmittedRequest(request, `Valid 5 — ${test.info().testId}`)
    await approve(request, created.id)
    await assign(request, created.id, IT_MEMBER_1)

    const response = await complete(request, created.id)
    expect(response.status()).toBe(200)
    expect((await response.json()).status).toBe('Completed')
  })

  test('6: cancel from Submitted -> 200, Cancelled', async ({ request }) => {
    const created = await createSubmittedRequest(request, `Valid 6 — ${test.info().testId}`)

    const response = await cancel(request, created.id)
    expect(response.status()).toBe(200)
    expect((await response.json()).status).toBe('Cancelled')
  })
})

test.describe('invalid transitions (docs/week2-agentic-workflow.md, Invalid transitions table)', () => {
  test('1: assign while Submitted -> 409, INVALID_TRANSITION', async ({ request }) => {
    const created = await createSubmittedRequest(request, `Invalid 1 — ${test.info().testId}`)

    // Acts as IT_HEAD so authorization clears and the transition table is
    // what actually refuses this - see the file-level note.
    const response = await assign(request, created.id, IT_MEMBER_1)
    expect(response.status()).toBe(409)
    expect(((await response.json()) as ErrorBody).error).toBe('INVALID_TRANSITION')
  })

  test('2: complete while Submitted -> 409, INVALID_TRANSITION', async ({ request }) => {
    const created = await createSubmittedRequest(request, `Invalid 2 — ${test.info().testId}`)

    const response = await complete(request, created.id)
    expect(response.status()).toBe(409)
    expect(((await response.json()) as ErrorBody).error).toBe('INVALID_TRANSITION')
  })

  test('3: complete while Approved -> 409, INVALID_TRANSITION', async ({ request }) => {
    const created = await createSubmittedRequest(request, `Invalid 3 — ${test.info().testId}`)
    await approve(request, created.id)

    const response = await complete(request, created.id)
    expect(response.status()).toBe(409)
    expect(((await response.json()) as ErrorBody).error).toBe('INVALID_TRANSITION')
  })

  test('4: approve while Approved -> 409, INVALID_TRANSITION', async ({ request }) => {
    const created = await createSubmittedRequest(request, `Invalid 4 — ${test.info().testId}`)
    await approve(request, created.id)

    // Acts as IT_HEAD again - otherwise this would 403 before ever
    // re-checking the transition table.
    const response = await approve(request, created.id)
    expect(response.status()).toBe(409)
    expect(((await response.json()) as ErrorBody).error).toBe('INVALID_TRANSITION')
  })

  test('5: cancel while Completed -> 409, INVALID_TRANSITION', async ({ request }) => {
    const created = await createSubmittedRequest(request, `Invalid 5 — ${test.info().testId}`)
    await approve(request, created.id)
    await assign(request, created.id, IT_MEMBER_1)
    await complete(request, created.id)

    const response = await cancel(request, created.id)
    expect(response.status()).toBe(409)
    expect(((await response.json()) as ErrorBody).error).toBe('INVALID_TRANSITION')
  })

  test('6: approve while Cancelled -> 409, INVALID_TRANSITION', async ({ request }) => {
    const created = await createSubmittedRequest(request, `Invalid 6 — ${test.info().testId}`)
    await cancel(request, created.id)

    // Acts as IT_HEAD - see the file-level note: without it, this would 403
    // before the transition table ever sees a Cancelled request.
    const response = await approve(request, created.id)
    expect(response.status()).toBe(409)
    expect(((await response.json()) as ErrorBody).error).toBe('INVALID_TRANSITION')
  })
})
