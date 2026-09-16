import { DepartmentRecord } from './domain/department.entity';

/**
 * The port the rest of the app talks to. Read-only: nothing in the app
 * writes a department yet, since there is no admin feature that owns that
 * write. The seed script writes rows directly through TypeORM, the same
 * layer this repository itself is built on.
 */
export abstract class DepartmentsRepository {
  abstract findById(id: string): Promise<DepartmentRecord | null>;
  abstract findAll(): Promise<DepartmentRecord[]>;
}
