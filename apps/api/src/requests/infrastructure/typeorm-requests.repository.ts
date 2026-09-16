import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RequestRecord } from '../domain/request.entity';
import { RequestsRepository } from '../requests.repository';
import { toDomain, toOrmEntity } from './request.mapper';
import { RequestOrmEntity } from './request.orm-entity';

/**
 * SQLite via TypeORM, behind the same port InMemoryRequestsRepository used
 * to implement. Nothing in the service or the domain moved to get here.
 *
 * save() writes version + 1 unconditionally and cannot fail on a stale
 * write. Comparing the incoming version against what is currently stored is
 * a separate, later change.
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
    row.version = request.version + 1;
    await this.repository.save(row);
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
