import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * department.headId and user.departmentId reference each other. SQLite
 * resolves a foreign key's parent table lazily rather than at CREATE TABLE
 * time, so department can be created first even though it points at a
 * table that does not exist yet.
 */
export class CreateDepartmentAndUserTables1789572634018 implements MigrationInterface {
  name = 'CreateDepartmentAndUserTables1789572634018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "department" ("id" varchar PRIMARY KEY NOT NULL, "name" text NOT NULL, "headId" varchar NOT NULL, CONSTRAINT "FK_department_head" FOREIGN KEY ("headId") REFERENCES "user" ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "name" text NOT NULL, "departmentId" varchar NOT NULL, CONSTRAINT "FK_user_department" FOREIGN KEY ("departmentId") REFERENCES "department" ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "department"`);
  }
}
