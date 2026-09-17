import { useEffect } from 'react'
import type { RequestDto } from './api/types'
import { DEPARTMENT_NAMES } from './users'
import { StatusPill, UserName } from './DepartmentQueue'

interface Props {
  request: RequestDto
  onClose: () => void
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

// A read-only view of everything the request shape carries (contract §1) —
// distinct from ConfirmDialog, which always drives toward one action. This
// one only ever closes.
export function RequestDetailsDialog({ request, onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog-card details-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="details-header">
          <h3 id="details-title">{request.title}</h3>
          <StatusPill status={request.status} />
        </div>

        <dl className="details-list">
          <dt>Requester</dt>
          <dd>
            <UserName id={request.requesterId} />
          </dd>

          <dt>Department</dt>
          <dd>{DEPARTMENT_NAMES[request.departmentId] ?? request.departmentId}</dd>

          <dt>Submitted</dt>
          <dd>{formatDateTime(request.submittedAt)}</dd>

          <dt>Assignee</dt>
          <dd>{request.assigneeId ? <UserName id={request.assigneeId} /> : '—'}</dd>

          {request.status === 'Cancelled' && (
            <>
              <dt>Cancellation reason</dt>
              <dd>{request.cancellationReason}</dd>
            </>
          )}

          {request.status === 'Completed' && request.completedAt && (
            <>
              <dt>Completed</dt>
              <dd>{formatDateTime(request.completedAt)}</dd>
            </>
          )}
        </dl>

        <p className="details-description">{request.description}</p>

        <div className="dialog-actions">
          <button type="button" className="dialog-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
