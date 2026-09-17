import type { ApiError } from './api/types'

// Renders the reason an action was refused, verbatim, on screen — not just
// in the network tab. Every branch here shows text the server itself wrote
// (contract §3's `message` field), which is what an E2E test would assert
// against, rather than a paraphrase this component invents.
export function ErrorBanner({ error }: { error: ApiError }) {
  const text = error.kind === 'VALIDATION' && error.cause === 'body' ? error.messages.join(' ') : error.message

  return (
    <div className="error-banner" role="alert">
      {text}
    </div>
  )
}
