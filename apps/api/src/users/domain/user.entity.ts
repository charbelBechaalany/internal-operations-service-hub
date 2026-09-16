/**
 * A user as this slice needs it: identity and the one department they
 * belong to. Role is deliberately absent, matching the data model: head is
 * a reference on Department, not a flag here.
 */
export interface UserRecord {
  readonly id: string;
  name: string;
  departmentId: string;
}
