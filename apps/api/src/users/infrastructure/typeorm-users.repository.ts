import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserRecord } from '../domain/user.entity';
import { UsersRepository } from '../users.repository';
import { toDomain } from './user.mapper';
import { UserOrmEntity } from './user.orm-entity';

@Injectable()
export class TypeOrmUsersRepository extends UsersRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repository: Repository<UserOrmEntity>,
  ) {
    super();
  }

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toDomain(row) : null;
  }

  async findAll(): Promise<UserRecord[]> {
    const rows = await this.repository.find();
    return rows.map(toDomain);
  }
}
