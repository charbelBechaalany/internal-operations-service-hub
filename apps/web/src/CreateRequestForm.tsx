import { useState, type FormEvent } from 'react'
import { createRequest } from './api/client'
import { ApiRequestError, type ApiError, type RequestDto } from './api/types'
import { DEPARTMENT_NAMES } from './users'
import { ConfirmDialog } from './ConfirmDialog'
import { ErrorBanner } from './ErrorBanner'

type Field = 'title' | 'description' | 'departmentId'

// The exact strings docs/api-contract.md §2 documents for CreateRequestDto.
// class-validator's message array carries these verbatim, so matching on
// them is matching the contract, not guessing at server internals.
const FIELD_MESSAGES: Record<string, Field> = {
  'A request must have a title.': 'title',
  'A request must have a description.': 'description',
  'A request must have an owning department.': 'departmentId',
}

interface Props {
  actorId: string
  onCreated: (created: RequestDto) => void
}

export function CreateRequestForm({ actorId, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [departmentId, setDepartmentId] = useState<string>(Object.keys(DEPARTMENT_NAMES)[0])
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({})
  // Anything a 400 reports that isn't one of the three known field
  // messages — should never happen against this contract, but shown rather
  // than swallowed if the server ever adds a rule this form doesn't know.
  const [formError, setFormError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setConfirmOpen(true)
  }

  async function handleConfirmCreate() {
    setConfirmOpen(false)
    setFieldErrors({})
    setFormError(null)
    setSubmitting(true)
    try {
      const created = await createRequest(actorId, { title, description, departmentId })
      setTitle('')
      setDescription('')
      onCreated(created)
    } catch (err) {
      if (!(err instanceof ApiRequestError)) throw err

      if (err.error.kind === 'VALIDATION' && err.error.cause === 'body') {
        const nextFieldErrors: Partial<Record<Field, string>> = {}
        const unmatched: string[] = []
        for (const message of err.error.messages) {
          const field = FIELD_MESSAGES[message]
          if (field) nextFieldErrors[field] = message
          else unmatched.push(message)
        }
        setFieldErrors(nextFieldErrors)
        if (unmatched.length > 0) {
          setFormError({ kind: 'VALIDATION', cause: 'body', messages: unmatched })
        }
      } else {
        // A missing X-User-Id (cause: 'missing-actor') lands here too — it
        // has nothing to do with any field, so it belongs in the form-level
        // banner, not next to title/description/department.
        setFormError(err.error)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        {fieldErrors.title && <div className="field-error">{fieldErrors.title}</div>}
      </label>
      <label>
        <span>Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        {fieldErrors.description && <div className="field-error">{fieldErrors.description}</div>}
      </label>
      <label>
        <span>Department</span>
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          {Object.entries(DEPARTMENT_NAMES).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        {fieldErrors.departmentId && <div className="field-error">{fieldErrors.departmentId}</div>}
      </label>
      {formError && <ErrorBanner error={formError} />}
      <button type="submit" disabled={submitting}>
        Submit
      </button>

      {confirmOpen && (
        <ConfirmDialog
          title="Create this request?"
          message={`"${title}" will be raised against ${DEPARTMENT_NAMES[departmentId]}. Once submitted it can't be edited — a request that needs changes has to be cancelled and raised again.`}
          confirmLabel="Create request"
          busy={submitting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirmCreate}
        />
      )}
    </form>
  )
}
