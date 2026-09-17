// Mirrors apps/api/src/database/seed.ts. There is no /users or /departments
// endpoint (the contract's intro: "departments and users... neither module
// exposes a controller yet"), so this is built from the same fixed seed
// data the API was seeded with, not fetched.

export interface SeededUser {
  id: string
  name: string
  departmentId: string
}

export interface SeededDepartment {
  id: string
  name: string
  headId: string
}

export const SEEDED_USERS: SeededUser[] = [
  { id: 'user-it-head', name: 'IT Head', departmentId: 'dept-it' },
  { id: 'user-it-member-1', name: 'IT Member 1', departmentId: 'dept-it' },
  { id: 'user-it-member-2', name: 'IT Member 2', departmentId: 'dept-it' },
  { id: 'user-hr-head', name: 'HR Head', departmentId: 'dept-hr' },
  { id: 'user-requester', name: 'Requester', departmentId: 'dept-hr' },
]

export const SEEDED_DEPARTMENTS: SeededDepartment[] = [
  { id: 'dept-it', name: 'IT', headId: 'user-it-head' },
  { id: 'dept-hr', name: 'HR', headId: 'user-hr-head' },
]

export const DEPARTMENT_NAMES: Record<string, string> = Object.fromEntries(
  SEEDED_DEPARTMENTS.map((d) => [d.id, d.name]),
)

// Derived from the department's headId rather than a flag on the user, per
// the actual data model: headId lives on Department (data-model.md §1),
// not on User.
export function isDepartmentHead(userId: string): boolean {
  const user = SEEDED_USERS.find((u) => u.id === userId)
  if (!user) return false
  const department = SEEDED_DEPARTMENTS.find((d) => d.id === user.departmentId)
  return department?.headId === userId
}

// assigneeId is never validated by the API (contract §2), so an id that
// names none of the five seeded users is an expected case, not a bug —
// the caller decides how to render "no match", this just reports it.
export function findUserName(userId: string): string | null {
  return SEEDED_USERS.find((u) => u.id === userId)?.name ?? null
}

// The assign dropdown's source list. The API doesn't check assigneeId
// against department membership (contract §2), so this is a UI-side
// narrowing for a sane picker, not enforcement of that invariant.
export function usersInDepartment(departmentId: string): SeededUser[] {
  return SEEDED_USERS.filter((u) => u.departmentId === departmentId)
}
