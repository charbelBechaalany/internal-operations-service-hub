import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * The database row. headId carries no ORM relation decorator, the same way
 * RequestOrmEntity.assigneeId does not: it is a plain id column, and the
 * foreign key constraint itself lives in the migration's raw SQL.
 */
@Entity({ name: 'department' })
export class DepartmentOrmEntity {
  @PrimaryColumn('varchar')
  id: string;

  @Column('text')
  name: string;

  @Column('varchar')
  headId: string;
}
