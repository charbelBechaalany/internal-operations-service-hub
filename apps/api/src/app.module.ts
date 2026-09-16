import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { dataSourceOptions } from './database/data-source';
import { RequestsModule } from './requests/requests.module';

@Module({
  imports: [TypeOrmModule.forRoot(dataSourceOptions), RequestsModule],
})
export class AppModule {}