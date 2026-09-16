import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DepartmentRecord } from '../domain/department.entity';
import { DepartmentsRepository } from '../departments.repository';
import { toDomain } from './department.mapper';
import { DepartmentOrmEntity } from './department.orm-entity';

@Injectable()
export class TypeOrmDepartmentsRepository extends DepartmentsRepository {
  constructor(
    @InjectRepository(DepartmentOrmEntity)
    private readonly repository: Repository<DepartmentOrmEntity>,
  ) {
    super();
  }

  async findById(id: string): Promise<DepartmentRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toDomain(row) : null;
  }

  async findAll(): Promise<DepartmentRecord[]> {
    const rows = await this.repository.find();
    return rows.map(toDomain);
  }
}
