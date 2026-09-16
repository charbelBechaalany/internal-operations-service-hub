import { Column, Entity, PrimaryColumn } from 'typeorm';

import { RequestStatus } from '../domain/request-status.enum';

/**
 * The database row. Kept separate from domain/request.entity.ts so that file
 * stays framework-free; this class is the only thing that knows about
 * TypeORM.
 *
 * status uses simple-enum, sqlite's stand-in for a native enum column: it
 * stores the value as text but still emits a CHECK constraint restricting it
 * to the five named values. "Status is one of exactly five values" is a
 * database constraint because of this line, not because of anything in the
 * domain.
 *
 * title and description are write-once in practice: only create() sets
 * them, and no later code path touches them. The database has no way to
 * enforce that, so it stays a fact about the code, not the schema.
 *
 * version is written by the repository on every save but not yet checked
 * against what is currently stored. See request.entity.ts.
 */
@Entity({ name: 'request' })
export class RequestOrmEntity {
  @PrimaryColumn('varchar')
  id: string;

  @Column('text')
  title: string;

  @Column('text')
  description: string;

  @Column('datetime')
  submittedAt: Date;

  @Column('varchar')
  requesterId: string;

  @Column('varchar')
  departmentId: string;

  @Column({ type: 'simple-enum', enum: RequestStatus })
  status: RequestStatus;

  @Column({ type: 'varchar', nullable: true })
  assigneeId: string | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'integer', default: 1 })
  version: number;
}
