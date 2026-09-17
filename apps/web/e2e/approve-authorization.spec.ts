import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * Fixed ids from apps/api/src/database/seed.ts, reset fresh before this
 * suite runs (see playwright.config.ts). These three rows are static
 * identity data - nothing in this suite ever changes a user's department or
 * a department's head - so every test can read them without needing its own
 * copy or a reseed in between.
 */
const IT_DEPARTMENT = 'dept-it'
const IT_HEAD = 'user-it-head'
const IT_MEMBER = 'user-it-member-1'
const IT_MEMBER_2 = 'user-it-member-2'
const REQUESTER = 'user-requester'

/**
 * Mints a fresh Submitted request through the real API rather than reusing
 * the seed's fixed request-it-1. That row is shared by the whole suite for
 * this run, and by every future run of it: a test that approved it would
 * leave it Approved for whichever test or run touched it next, with no
 * reseed in between to reset it back (the reseed in playwright.config.ts
 * runs once per webServer start, not once per test). A request with its own
 * generated id can't collide with anything, because nothing else has ever
 * held that id.
 */
async function createSubmittedRequest(request: APIRequestContext, title: string) {
  const response = await request.post('/requests', {
    headers: { 'X-User-Id': REQUESTER },
    data: {
      title,
      description: 'Created directly through the API by an end-to-end test.',
      departmentId: IT_DEPARTMENT,
    },
  })
  expect(response.ok(), `POST /requests failed: ${await response.text()}`).toBeTruthy()
  return (await response.json()) as { id: string; status: string }
}

test.describe('approving a request is authorized end to end', () => {
  test('the IT head approves a submitted request and sees it change on screen', async ({ page, request }) => {
    const created = await createSubmittedRequest(request, `Head approves — ${test.info().testId}`)

    await page.goto('/')
    await page.getByLabel('User').selectOption(IT_HEAD)

    const row = page.locator(`[data-request-id="${created.id}"]`)
    await expect(row).toBeVisible()
    await expect(row.locator('.status-pill')).toHaveText('Submitted')

    await row.getByRole('button', { name: 'Approve', exact: true }).click()
    await row.getByRole('alertdialog').getByRole('button', { name: 'Approve', exact: true }).click()

    await expect(row.locator('.status-pill')).toHaveText('Approved')

    // The status pill is local React state updated from the response body.
    // A fresh GET against the real API confirms the write actually reached
    // the database, not just this one page's copy of it.
    const reloaded = await request.get(`/requests/${created.id}`)
    expect((await reloaded.json()).status).toBe('Approved')
  })

  test('an IT member who is not the head is refused, and the refusal renders on the page', async ({
    page,
    request,
  }) => {
    const created = await createSubmittedRequest(request, `Member refused — ${test.info().testId}`)

    // A Submitted, unassigned request never appears in a non-head's queue -
    // DepartmentQueue.tsx's visibility filter matches product-spec.md's "a
    // department member sees only what is assigned to them", so there is
    // nothing there for IT_MEMBER to open. To put a row in front of a
    // non-head member at all, it has to already be assigned to them, which
    // means reaching InProgress first (through the real API, as the head)
    // before this test can act as the member. Reassign is the action under
    // test below rather than approve, since it is the one head-only action
    // available on a row a member can legitimately see.
    const approved = await request.post(`/requests/${created.id}/approve`, {
      headers: { 'X-User-Id': IT_HEAD },
    })
    expect(approved.ok(), `approve failed: ${await approved.text()}`).toBeTruthy()
    const assigned = await request.post(`/requests/${created.id}/assign`, {
      headers: { 'X-User-Id': IT_HEAD },
      data: { assigneeId: IT_MEMBER },
    })
    expect(assigned.ok(), `assign failed: ${await assigned.text()}`).toBeTruthy()

    // The server's own words for this refusal, captured from a direct call
    // by the same actor attempting the same action, so the page assertion
    // below checks against what the API actually said - not a UI paraphrase
    // and not this test guessing at NotDepartmentHeadError's wording.
    const directAttempt = await request.post(`/requests/${created.id}/assign`, {
      headers: { 'X-User-Id': IT_MEMBER },
      data: { assigneeId: IT_MEMBER_2 },
    })
    expect(directAttempt.status()).toBe(403)
    const refusal = (await directAttempt.json()) as { error: string; message: string }
    expect(refusal.error).toBe('NOT_DEPARTMENT_HEAD')

    await page.goto('/')
    await page.getByLabel('User').selectOption(IT_MEMBER)

    const row = page.locator(`[data-request-id="${created.id}"]`)
    await expect(row).toBeVisible()
    await expect(row.locator('.status-pill')).toHaveText('InProgress')

    await row.getByRole('button', { name: 'Reassign', exact: true }).click()
    await row.getByRole('alertdialog').getByLabel('Assignee').selectOption(IT_MEMBER_2)
    await row.getByRole('alertdialog').getByRole('button', { name: 'Reassign', exact: true }).click()

    await expect(row.getByRole('alert')).toHaveText(refusal.message)

    // The refusal changed nothing: still assigned to IT_MEMBER on screen,
    // and still assigned to IT_MEMBER in the database - this test's earlier
    // direct call didn't touch it either (that call also 403'd, not just
    // this UI attempt).
    await expect(row.locator('td').nth(3)).toHaveText('IT Member 1')
    const reloaded = await request.get(`/requests/${created.id}`)
    expect((await reloaded.json()).assigneeId).toBe(IT_MEMBER)
    expect((await reloaded.json()).status).toBe('InProgress')
  })
})
