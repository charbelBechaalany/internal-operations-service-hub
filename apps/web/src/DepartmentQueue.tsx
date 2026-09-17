import { useState } from 'react'
import { approveRequest, assignRequest, cancelRequest, completeRequest } from './api/client'
import { ApiRequestError, type ApiError, type RequestDto, type RequestStatus } from './api/types'
import { findUserName, usersInDepartment } from './users'
import { ConfirmDialog } from './ConfirmDialog'
import { ErrorBanner } from './ErrorBanner'
import { RequestDetailsDialog } from './RequestDetailsDialog'

const NON_TERMINAL: RequestStatus[] = ['Submitted', 'Approved', 'InProgress']

type PendingType = 'approve' | 'assign' | 'cancel' | 'complete'

function nameOf(userId: string): string {
  return findUserName(userId) ?? userId
}

interface Props {
  actorId: string
  departmentId: string
  isHead: boolean
  requests: RequestDto[]
  onUpdate: (updated: RequestDto) => void
  onNotFound: (requestId: string) => void
}

export function DepartmentQueue({ actorId, departmentId, isHead, requests, onUpdate, onNotFound }: Props) {
  // Display-only visibility filter. The API returns every request to every
  // caller regardless of role (contract §1, "Visibility") — nothing below
  // is enforced server-side, so this hides rows in the browser but does not
  // protect them; the same data is one network request away. A head sees
  // the full department queue; anyone else sees only requests assigned to
  // them, which is also why Submitted and Approved requests never show for
  // a non-head — assigneeId is null on both, so neither can match.
  const queue = requests
    .filter((r) => r.departmentId === departmentId)
    .filter((r) => isHead || r.assigneeId === actorId)
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))

  if (queue.length === 0) {
    return <p>No requests in this queue.</p>
  }

  return (
    <table className="queue-table">
      <colgroup>
        <col style={{ width: '32%' }} />
        <col style={{ width: '16%' }} />
        <col style={{ width: '13%' }} />
        <col style={{ width: '16%' }} />
        <col style={{ width: '23%' }} />
      </colgroup>
      <thead>
        <tr>
          <th>Title</th>
          <th>Requester</th>
          <th>Status</th>
          <th>Assignee</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {queue.map((r) => (
          <QueueRow
            key={r.id}
            actorId={actorId}
            isHead={isHead}
            request={r}
            onUpdate={onUpdate}
            onNotFound={onNotFound}
          />
        ))}
      </tbody>
    </table>
  )
}

export function UserName({ id }: { id: string }) {
  const name = findUserName(id)
  // assigneeId is never validated by the API (contract §2), so an id
  // matching none of the five seeded users is expected, not a bug — the id
  // stays available on hover instead of being shown as if it were a name.
  if (!name) {
    return <span title={id}>Unknown user</span>
  }
  return <span>{name}</span>
}

export function StatusPill({ status }: { status: RequestStatus }) {
  return <span className={`status-pill status-${status}`}>{status}</span>
}

interface RowProps {
  actorId: string
  isHead: boolean
  request: RequestDto
  onUpdate: (updated: RequestDto) => void
  onNotFound: (requestId: string) => void
}

function QueueRow({ actorId, isHead, request, onUpdate, onNotFound }: RowProps) {
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingType, setPendingType] = useState<PendingType | null>(null)
  // Only one of these is ever read, matching whichever dialog is open — kept
  // separate rather than a shared "value" field so each has its own shape
  // (a picked id vs. free text) and its own reset when a dialog opens.
  const [assigneeChoice, setAssigneeChoice] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)

  const alreadyAssigned = request.status === 'InProgress'
  const members = usersInDepartment(request.departmentId)

  function openDialog(type: PendingType) {
    setAssigneeChoice('')
    setCancelReason('')
    setPendingType(type)
  }

  async function run(call: () => Promise<RequestDto>) {
    setError(null)
    setBusy(true)
    try {
      const updated = await call()
      onUpdate(updated)
    } catch (err) {
      if (!(err instanceof ApiRequestError)) throw err
      if (err.error.kind === 'REQUEST_CONFLICT') {
        // The error body already carries the true current row (contract
        // §3) — swap it in so the queue reflects reality without a
        // separate GET, and leave the message visible below explaining why.
        onUpdate(err.error.currentState)
      } else if (err.error.kind === 'REQUEST_NOT_FOUND') {
        onNotFound(request.id)
      }
      setError(err.error)
    } finally {
      setBusy(false)
    }
  }

  function confirmPending() {
    const type = pendingType
    setPendingType(null)
    switch (type) {
      case 'approve':
        run(() => approveRequest(actorId, request.id))
        break
      case 'assign':
        run(() => assignRequest(actorId, request.id, { assigneeId: assigneeChoice }))
        break
      case 'cancel':
        run(() => cancelRequest(request.id, { reason: cancelReason }))
        break
      case 'complete':
        run(() => completeRequest(request.id))
        break
    }
  }

  return (
    <tr data-request-id={request.id}>
      <td>
        <button type="button" className="link-button" onClick={() => setDetailsOpen(true)}>
          {request.title}
        </button>
        {detailsOpen && <RequestDetailsDialog request={request} onClose={() => setDetailsOpen(false)} />}
      </td>
      <td>
        <UserName id={request.requesterId} />
      </td>
      <td>
        <StatusPill status={request.status} />
      </td>
      <td>{request.assigneeId ? <UserName id={request.assigneeId} /> : '—'}</td>
      <td>
        <div className="request-actions">
          {isHead && request.status === 'Submitted' && (
            <button className="action-btn" disabled={busy} onClick={() => openDialog('approve')}>
              Approve
            </button>
          )}
          {isHead && (request.status === 'Approved' || request.status === 'InProgress') && (
            <button className="action-btn" disabled={busy} onClick={() => openDialog('assign')}>
              {alreadyAssigned ? 'Reassign' : 'Assign'}
            </button>
          )}
          {isHead && NON_TERMINAL.includes(request.status) && (
            <button className="action-btn action-btn-danger" disabled={busy} onClick={() => openDialog('cancel')}>
              Cancel
            </button>
          )}
          {request.assigneeId === actorId && request.status === 'InProgress' && (
            <button className="action-btn" disabled={busy} onClick={() => openDialog('complete')}>
              Complete
            </button>
          )}
        </div>
        {error && <ErrorBanner error={error} />}

        {pendingType === 'approve' && (
          <ConfirmDialog
            title="Approve this request?"
            message={`"${request.title}" will move to Approved and become ready for assignment.`}
            confirmLabel="Approve"
            busy={busy}
            onCancel={() => setPendingType(null)}
            onConfirm={confirmPending}
          />
        )}

        {pendingType === 'assign' && (
          <ConfirmDialog
            title={alreadyAssigned ? 'Reassign this request?' : 'Assign this request?'}
            message={
              alreadyAssigned
                ? `"${request.title}" is currently with ${nameOf(request.assigneeId ?? '')}. Choose who should take it over.`
                : `"${request.title}" will move to In Progress under whoever you choose.`
            }
            confirmLabel={alreadyAssigned ? 'Reassign' : 'Assign'}
            confirmDisabled={assigneeChoice === ''}
            busy={busy}
            onCancel={() => setPendingType(null)}
            onConfirm={confirmPending}
          >
            <label className="dialog-field">
              <span>Assignee</span>
              <select value={assigneeChoice} onChange={(e) => setAssigneeChoice(e.target.value)} autoFocus>
                <option value="" disabled>
                  Choose a team member…
                </option>
                {members.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          </ConfirmDialog>
        )}

        {pendingType === 'cancel' && (
          <ConfirmDialog
            title="Cancel this request?"
            message={`"${request.title}" will be marked Cancelled. This cannot be undone.`}
            confirmLabel="Cancel request"
            confirmDisabled={cancelReason.trim() === ''}
            danger
            busy={busy}
            onCancel={() => setPendingType(null)}
            onConfirm={confirmPending}
          >
            <label className="dialog-field">
              <span>Reason</span>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="Why is this request being cancelled?"
                autoFocus
              />
            </label>
          </ConfirmDialog>
        )}

        {pendingType === 'complete' && (
          <ConfirmDialog
            title="Mark this request complete?"
            message={`"${request.title}" will be marked Completed and the completion time recorded.`}
            confirmLabel="Mark complete"
            busy={busy}
            onCancel={() => setPendingType(null)}
            onConfirm={confirmPending}
          />
        )}
      </td>
    </tr>
  )
}
