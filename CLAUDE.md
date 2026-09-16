# CLAUDE.md

## Source of truth

`docs/product-spec.md`, `docs/architecture.md`, and `docs/data-model.md` are
the source of truth. Read all three before any design decision.

## Invariants

- `apps/api/src/requests/domain/` imports nothing from NestJS or any ORM.
- Every status change goes through `applyTransition` in `requests.service.ts`.
  Never add a second path that writes a status.
- `domain/transitions.ts` decides what moves are legal, and nothing else
  does. It never takes a user or a role as a parameter.
- Error codes are distinct: 400 validation, 403 wrong actor, 409 wrong move
  or conflict, 404 not found.
- No component without a stated reason.

## Current scope

Week 3 is one slice: a head of department approving and assigning a
request. Stack: React, NestJS, SQLite.
