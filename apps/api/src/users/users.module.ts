import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersRepository } from './users.repository';
import { UserOrmEntity } from './infrastructure/user.orm-entity';
import { TypeOrmUsersRepository } from './infrastructure/typeorm-users.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  providers: [
    {
      provide: UsersRepository,
      useClass: TypeOrmUsersRepository,
    },
  ],
  exports: [UsersRepository],
})
export class UsersModule {}
