import { randomUUID } from 'crypto';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { InvalidTransitionError } from '../common/invalid-transition.error';
import { DepartmentsModule } from '../departments/departments.module';
import { DepartmentOrmEntity } from '../departments/infrastructure/department.orm-entity';
import { UserOrmEntity } from '../users/infrastructure/user.orm-entity';
import { RequestStatus } from './domain/request-status.enum';
import { RequestOrmEntity } from './infrastructure/request.orm-entity';
import { RequestsRepository, StaleWriteError } from './requests.repository';
import { RequestsModule } from './requests.module';
import { RequestsService } from './requests.service';

/**
 * Exercises RequestsService against a real SQLite database rather than a
 * mocked repository. The service depends on DepartmentsRepository too (see
 * assertIsDepartmentHead), so this wires DepartmentsModule in for real
 * instead of stubbing it - a stub would let the test pass while the actual
 * repository wiring stayed broken.
 *
 * Each test gets its own ':memory:' sqlite connection via
 * TypeOrmModule.forRoot, so there is no shared file and nothing to clean up
 * between tests.
 */
describe('RequestsService (integration)', () => {
  let moduleRef: TestingModule;
  let service: RequestsService;
  let repository: RequestsRepository;
  let departmentRepo: Repository<DepartmentOrmEntity>;
  let userRepo: Repository<UserOrmEntity>;

  let departmentId: string;
  let headId: string;
  let requesterId: string;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [RequestOrmEntity, DepartmentOrmEntity, UserOrmEntity],
          synchronize: true,
          dropSchema: true,
        }),
        RequestsModule,
        DepartmentsModule,
        // Not for domain logic - RequestsModule and DepartmentsModule
        // already provide that. This just exposes the raw TypeORM
        // repositories at the root so the test can seed rows directly.
        TypeOrmModule.forFeature([DepartmentOrmEntity, UserOrmEntity]),
      ],
    }).compile();

    service = moduleRef.get(RequestsService);
    repository = moduleRef.get(RequestsRepository);
    departmentRepo = moduleRef.get(getRepositoryToken(DepartmentOrmEntity));
    userRepo = moduleRef.get(getRepositoryToken(UserOrmEntity));

    departmentId = randomUUID();
    headId = randomUUID();
    requesterId = randomUUID();

    // Seeded directly through the ORM, the same layer the app's own seed
    // script uses - not through a stub, so the head lookup the service does
    // via DepartmentsRepository is exercising the real table.
    await userRepo.insert({ id: headId, name: 'Head of Department', departmentId });
    await userRepo.insert({ id: requesterId, name: 'Requester', departmentId });
    await departmentRepo.insert({ id: departmentId, name: 'Engineering', headId });
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('persists an approval so it survives a reload', async () => {
    const created = await service.create('Laptop', 'Need a laptop', departmentId, requesterId);

    const approved = await service.approve(created.id, headId);
    expect(approved.status).toBe(RequestStatus.Approved);

    // A fresh read through the service, not the mutated object approve()
    // returned, so this actually proves the write reached the database.
    const reloaded = await service.findById(created.id);
    expect(reloaded).toEqual(approved);
    expect(reloaded.status).toBe(RequestStatus.Approved);
    expect(reloaded.version).toBe(approved.version);
  });

  it('leaves the row exactly as it was when a transition is rejected', async () => {
    const created = await service.create('Laptop', 'Need a laptop', departmentId, requesterId);

    // A fresh read before the attempt, independent of the object create()
    // handed back, so the "before" snapshot also comes from the database.
    const before = await service.findById(created.id);

    // Submitted -> Complete is not a legal move (see transitions.spec.ts).
    await expect(service.complete(created.id)).rejects.toThrow(InvalidTransitionError);

    const after = await service.findById(created.id);

    // No trace of the attempt: not just the status, the entire row -
    // including version - is unchanged. A version bump here would mean the
    // service wrote something before checking the transition was legal.
    expect(after).toEqual(before);
    expect(after.status).toBe(RequestStatus.Submitted);
    expect(after.completedAt).toBeNull();
    expect(after.version).toBe(before.version);
  });

  it('rejects a second save computed from the same base version', async () => {
    const created = await service.create('Laptop', 'Need a laptop', departmentId, requesterId);

    // Two actors load the same row and each compute a change from that same
    // base version - the shape of a real conflict, not a synthetic one.
    const firstActorsCopy = await repository.findById(created.id);
    const secondActorsCopy = await repository.findById(created.id);
    expect(firstActorsCopy.version).toBe(secondActorsCopy.version);

    firstActorsCopy.status = RequestStatus.Approved;
    await repository.save(firstActorsCopy);
    expect(firstActorsCopy.version).toBe(secondActorsCopy.version + 1);

    secondActorsCopy.status = RequestStatus.Cancelled;
    secondActorsCopy.cancellationReason = 'no longer needed';
    await expect(repository.save(secondActorsCopy)).rejects.toThrow(StaleWriteError);

    // The rejected write left no trace: the row still reflects the first,
    // successful save, not a partial application of the second.
    const current = await repository.findById(created.id);
    expect(current.status).toBe(RequestStatus.Approved);
    expect(current.cancellationReason).toBeNull();
    expect(current.version).toBe(firstActorsCopy.version);
  });
});
