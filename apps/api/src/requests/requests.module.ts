import { Module } from '@nestjs/common';

import { InMemoryRequestsRepository } from './in-memory-requests.repository';
import { RequestsController } from './requests.controller';
import { RequestsRepository } from './requests.repository';
import { RequestsService } from './requests.service';

@Module({
  controllers: [RequestsController],
  providers: [
    RequestsService,
    {
      // The one line that changes when a database replaces the in-memory
      // store. Nothing in the service or the domain moves.
      provide: RequestsRepository,
      useClass: InMemoryRequestsRepository,
    },
  ],
})
export class RequestsModule {}