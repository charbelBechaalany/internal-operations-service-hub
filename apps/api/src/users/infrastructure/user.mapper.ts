import { UserRecord } from '../domain/user.entity';
import { UserOrmEntity } from './user.orm-entity';

/**
 * The only place that knows both shapes exist.
 */
export function toDomain(row: UserOrmEntity): UserRecord {
  return {
    id: row.id,
    name: row.name,
    departmentId: row.departmentId,
  };
}

export function toOrmEntity(user: UserRecord): UserOrmEntity {
  const row = new UserOrmEntity();
  row.id = user.id;
  row.name = user.name;
  row.departmentId = user.departmentId;
  return row;
}
