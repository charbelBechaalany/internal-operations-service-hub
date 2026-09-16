import { DepartmentRecord } from '../domain/department.entity';
import { DepartmentOrmEntity } from './department.orm-entity';

/**
 * The only place that knows both shapes exist.
 */
export function toDomain(row: DepartmentOrmEntity): DepartmentRecord {
  return {
    id: row.id,
    name: row.name,
    headId: row.headId,
  };
}

export function toOrmEntity(department: DepartmentRecord): DepartmentOrmEntity {
  const row = new DepartmentOrmEntity();
  row.id = department.id;
  row.name = department.name;
  row.headId = department.headId;
  return row;
}
