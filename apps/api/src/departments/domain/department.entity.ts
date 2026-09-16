/**
 * A department as the data model defines it: it points at its head, rather
 * than the head being a flag on a user. One row here answers "who heads
 * this department" for any authorization check that needs it.
 */
export interface DepartmentRecord {
  readonly id: string;
  name: string;
  headId: string;
}
