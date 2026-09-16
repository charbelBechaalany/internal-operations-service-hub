import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DepartmentsRepository } from './departments.repository';
import { DepartmentOrmEntity } from './infrastructure/department.orm-entity';
import { TypeOrmDepartmentsRepository } from './infrastructure/typeorm-departments.repository';

@Module({
  imports: [TypeOrmModule.forFeature([DepartmentOrmEntity])],
  providers: [
    {
      provide: DepartmentsRepository,
      useClass: TypeOrmDepartmentsRepository,
    },
  ],
  exports: [DepartmentsRepository],
})
export class DepartmentsModule {}
