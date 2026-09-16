import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SQLite has no ALTER TABLE for adding a NOT NULL foreign-key column to a
 * table that may already hold rows, so this recreates "request" the same
 * way TypeORM's own sqlite driver would for a change like this: build the
 * new shape, drop the old table, rename.
 *
 * There is no data-copy step, because there is no request data worth
 * preserving at this stage of the project. A migration that runs this
 * against a populated table would need to backfill departmentId on the
 * existing rows before recreating.
 */
export class AddDepartmentToRequest1789572634019 implements MigrationInterface {
  name = 'AddDepartmentToRequest1789572634019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "request_new" ("id" varchar PRIMARY KEY NOT NULL, "title" text NOT NULL, "description" text NOT NULL, "submittedAt" datetime NOT NULL, "departmentId" varchar NOT NULL, "status" varchar CHECK( "status" IN ('Submitted','Approved','InProgress','Completed','Cancelled') ) NOT NULL, "assigneeId" varchar, "cancellationReason" text, "completedAt" datetime, "version" integer NOT NULL DEFAULT (1), CONSTRAINT "FK_request_department" FOREIGN KEY ("departmentId") REFERENCES "department" ("id"))`,
    );
    await queryRunner.query(`DROP TABLE "request"`);
    await queryRunner.query(`ALTER TABLE "request_new" RENAME TO "request"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "request_old" ("id" varchar PRIMARY KEY NOT NULL, "title" text NOT NULL, "description" text NOT NULL, "submittedAt" datetime NOT NULL, "status" varchar CHECK( "status" IN ('Submitted','Approved','InProgress','Completed','Cancelled') ) NOT NULL, "assigneeId" varchar, "cancellationReason" text, "completedAt" datetime, "version" integer NOT NULL DEFAULT (1))`,
    );
    await queryRunner.query(`DROP TABLE "request"`);
    await queryRunner.query(`ALTER TABLE "request_old" RENAME TO "request"`);
  }
}
