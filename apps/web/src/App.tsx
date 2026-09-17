import { useEffect, useState } from 'react'
import { listRequests } from './api/client'
import type { RequestDto } from './api/types'
import { SEEDED_USERS, DEPARTMENT_NAMES, isDepartmentHead } from './users'
import { CreateRequestForm } from './CreateRequestForm'
import { DepartmentQueue } from './DepartmentQueue'

export default function App() {
  // Defaults to a real seeded user so the X-User-Id header is never missing
  // from this UI — the dropdown can only select an id that exists, so the
  // 'missing-actor' VALIDATION case is a defensive branch, not a reachable
  // one, and the 400s this app can actually produce are body validation.
  const [actorId, setActorId] = useState(SEEDED_USERS[0].id)
  const [requests, setRequests] = useState<RequestDto[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const actor = SEEDED_USERS.find((u) => u.id === actorId)!
  const isHead = isDepartmentHead(actorId)

  useEffect(() => {
    listRequests()
      .then(setRequests)
      .catch(() => setLoadError('Could not load requests.'))
  }, [])

  function updateRequest(updated: RequestDto) {
    setRequests((prev) => {
      const exists = prev.some((r) => r.id === updated.id)
      return exists ? prev.map((r) => (r.id === updated.id ? updated : r)) : [...prev, updated]
    })
  }

  function removeRequest(requestId: string) {
    setRequests((prev) => prev.filter((r) => r.id !== requestId))
  }

  return (
    <div className="page">
      <header className="app-header">
        <div className="app-logo">SH</div>
        <div>
          <h1>Service Hub</h1>
          <p>Raise, approve, and assign internal department requests.</p>
        </div>
      </header>

      <section className="card">
        <h2>Acting as</h2>
        <label>
          <span>User</span>
          <select value={actorId} onChange={(e) => setActorId(e.target.value)}>
            {SEEDED_USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {DEPARTMENT_NAMES[u.departmentId]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2>Create a request</h2>
        <CreateRequestForm actorId={actorId} onCreated={updateRequest} />
      </section>

      <section className="card">
        <h2>{DEPARTMENT_NAMES[actor.departmentId]} queue</h2>
        {loadError && (
          <div className="error-banner" role="alert">
            {loadError}
          </div>
        )}
        <DepartmentQueue
          actorId={actorId}
          departmentId={actor.departmentId}
          isHead={isHead}
          requests={requests}
          onUpdate={updateRequest}
          onNotFound={removeRequest}
        />
      </section>
    </div>
  )
}
