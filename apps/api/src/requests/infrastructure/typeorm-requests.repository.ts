import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RequestRecord } from '../domain/request.entity';
import { RequestsRepository, StaleWriteError } from '../requests.repository';
import { toDomain, toOrmEntity } from './request.mapper';
import { RequestOrmEntity } from './request.orm-entity';

/**
 * SQLite via TypeORM, behind the same port InMemoryRequestsRepository used
 * to implement. Nothing in the service or the domain moved to get here.
 *
 * save() on a new record (version 0) inserts unconditionally, since nothing
 * else could be racing a row that does not exist yet.
 *
 * save() on an existing record is a conditional UPDATE guarded by
 * `WHERE id = :id AND version = :version`, using the version the caller
 * loaded (request.version is left untouched by the service's mutation, so it
 * is still the base version the actor read). If no row matches - because
 * someone else's write already moved the version on - `affected` is 0 and we
 * throw StaleWriteError rather than silently doing nothing.
 *
 * This is a plain conditional UPDATE with an affected-row check, not an
 * ORM-specific locking feature, so the same query shape works unchanged
 * against Postgres.
 *
 * save() writes the persisted version back onto the caller's `request`
 * object once the write actually lands. Without this, the RequestRecord the
 * service returns to its caller would still carry the version it read
 * before the write - a client holding it would be handed a version already
 * one behind what is stored, which fails that client's own next write for
 * no reason. This is part of the port's contract (see requests.repository.ts),
 * not a detail specific to this backend.
 */
@Injectable()
export class TypeOrmRequestsRepository extends RequestsRepository {
  constructor(
    @InjectRepository(RequestOrmEntity)
    private readonly repository: Repository<RequestOrmEntity>,
  ) {
    super();
  }

  async save(request: RequestRecord): Promise<void> {
    const row = toOrmEntity(request);

    if (request.version === 0) {
      row.version = 1;
      await this.repository.insert(row);
      request.version = 1;
      return;
    }

    const nextVersion = request.version + 1;
    const result = await this.repository
      .createQueryBuilder()
      .update(RequestOrmEntity)
      .set({
        title: row.title,
        description: row.description,
        submittedAt: row.submittedAt,
        requesterId: row.requesterId,
        departmentId: row.departmentId,
        status: row.status,
        assigneeId: row.assigneeId,
        cancellationReason: row.cancellationReason,
        completedAt: row.completedAt,
        version: nextVersion,
      })
      .where('id = :id AND version = :version', { id: request.id, version: request.version })
      .execute();

    if (result.affected === 0) {
      throw new StaleWriteError(request.id);
    }

    request.version = nextVersion;
  }

  async findById(id: string): Promise<RequestRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toDomain(row) : null;
  }

  async findAll(): Promise<RequestRecord[]> {
    const rows = await this.repository.find();
    return rows.map(toDomain);
  }
}
