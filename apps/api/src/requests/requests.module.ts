import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DepartmentsModule } from '../departments/departments.module';
import { RequestOrmEntity } from './infrastructure/request.orm-entity';
import { TypeOrmRequestsRepository } from './infrastructure/typeorm-requests.repository';
import { RequestsController } from './requests.controller';
import { RequestsRepository } from './requests.repository';
import { RequestsService } from './requests.service';

@Module({
  imports: [TypeOrmModule.forFeature([RequestOrmEntity]), DepartmentsModule],
  controllers: [RequestsController],
  providers: [
    RequestsService,
    {
      // The line that changes when storage changes. Nothing in the service
      // or the domain moves.
      provide: RequestsRepository,
      useClass: TypeOrmRequestsRepository,
    },
  ],
})
export class RequestsModule {}