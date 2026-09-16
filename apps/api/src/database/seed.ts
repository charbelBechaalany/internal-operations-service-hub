import { DataSource } from 'typeorm';

import { dataSourceOptions } from './data-source';
import { DepartmentRecord } from '../departments/domain/department.entity';
import { toOrmEntity as departmentToOrmEntity } from '../departments/infrastructure/department.mapper';
import { DepartmentOrmEntity } from '../departments/infrastructure/department.orm-entity';
import { RequestStatus } from '../requests/domain/request-status.enum';
import { RequestRecord } from '../requests/domain/request.entity';
import { toOrmEntity as requestToOrmEntity } from '../requests/infrastructure/request.mapper';
import { RequestOrmEntity } from '../requests/infrastructure/request.orm-entity';
import { UserRecord } from '../users/domain/user.entity';
import { toOrmEntity as userToOrmEntity } from '../users/infrastructure/user.mapper';
import { UserOrmEntity } from '../users/infrastructure/user.orm-entity';

/**
 * Fixed ids, not generated ones, because the point of this seed is a
 * reproducible allowed/denied authorization pair: user-it-head is the head
 * of dept-it and may act on request-it-1; user-it-member-1 belongs to the
 * same department but is not its head and may not. That second case is the
 * sharper test, since a check that only compared departments (instead of
 * the actual headId) would wrongly let it through.
 *
 * This writes through the same mapper + TypeORM repository layer
 * RequestsService.create() itself writes through, not through the service,
 * for two reasons: the service always generates its own id, and even if it
 * didn't, seeding never performs a status *change* — it only inserts a
 * request already in its initial Submitted state, exactly what create()
 * does without going through applyTransition. So this is the same path
 * creation already uses, from a different caller, not a second one.
 */
const departments: DepartmentRecord[] = [
  { id: 'dept-it', name: 'IT', headId: 'user-it-head' },
  { id: 'dept-hr', name: 'HR', headId: 'user-hr-head' },
];

const users: UserRecord[] = [
  { id: 'user-it-head', name: 'IT Head', departmentId: 'dept-it' },
  { id: 'user-it-member-1', name: 'IT Member 1', departmentId: 'dept-it' },
  { id: 'user-it-member-2', name: 'IT Member 2', departmentId: 'dept-it' },
  { id: 'user-hr-head', name: 'HR Head', departmentId: 'dept-hr' },
  { id: 'user-requester', name: 'Requester', departmentId: 'dept-hr' },
];

const requests: RequestRecord[] = [
  {
    id: 'request-it-1',
    title: 'New laptop request',
    description: 'Requesting a replacement laptop for the HR team.',
    submittedAt: new Date('2026-01-01T09:00:00Z'),
    requesterId: 'user-requester',
    departmentId: 'dept-it',
    status: RequestStatus.Submitted,
    assigneeId: null,
    cancellationReason: null,
    completedAt: null,
    version: 1,
  },
];

async function seed(): Promise<void> {
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  try {
    await dataSource.transaction(async (manager) => {
      // department.headId and user.departmentId reference each other.
      // TypeORM's sqlite driver enables PRAGMA foreign_keys by default, so
      // deferring the check to commit is what lets both sets of rows be
      // written in either order within this one transaction.
      await manager.query('PRAGMA defer_foreign_keys = ON');

      await manager
        .getRepository(DepartmentOrmEntity)
        .upsert(departments.map(departmentToOrmEntity), ['id']);
      await manager.getRepository(UserOrmEntity).upsert(users.map(userToOrmEntity), ['id']);
      await manager.getRepository(RequestOrmEntity).upsert(requests.map(requestToOrmEntity), ['id']);
    });
  } finally {
    await dataSource.destroy();
  }
}

seed()
  .then(() => {
    console.log('Seed complete.');
  })
  .catch((error) => {
    console.error('Seed failed.', error);
    process.exitCode = 1;
  });
