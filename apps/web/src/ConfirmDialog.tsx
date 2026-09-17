import { useEffect, type ReactNode } from 'react'

interface Props {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  busy: boolean
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

// A single reusable confirmation step in front of every status-changing
// action (approve, assign/reassign, cancel, complete). Anything the action
// itself needs to collect — an assignee, a cancellation reason — lives here
// as `children`, so the triggering control in the table can stay a plain
// button instead of a whole inline form.
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  busy,
  confirmDisabled,
  onConfirm,
  onCancel,
  children,
}: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="dialog-title">{title}</h3>
        <p>{message}</p>
        {children}
        <div className="dialog-actions">
          <button type="button" className="dialog-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'dialog-primary dialog-danger' : 'dialog-primary'}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
