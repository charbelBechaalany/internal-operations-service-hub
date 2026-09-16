import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Same recreate pattern as AddDepartmentToRequest1789572634019, and for the
 * same reason: SQLite has no ALTER TABLE for adding a NOT NULL foreign-key
 * column to a table that may already hold rows. No data-copy step, for the
 * same reason as that migration — there is no request data worth preserving
 * at this stage of the project.
 */
export class AddRequesterToRequest1789572634020 implements MigrationInterface {
  name = 'AddRequesterToRequest1789572634020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "request_new" ("id" varchar PRIMARY KEY NOT NULL, "title" text NOT NULL, "description" text NOT NULL, "submittedAt" datetime NOT NULL, "requesterId" varchar NOT NULL, "departmentId" varchar NOT NULL, "status" varchar CHECK( "status" IN ('Submitted','Approved','InProgress','Completed','Cancelled') ) NOT NULL, "assigneeId" varchar, "cancellationReason" text, "completedAt" datetime, "version" integer NOT NULL DEFAULT (1), CONSTRAINT "FK_request_requester" FOREIGN KEY ("requesterId") REFERENCES "user" ("id"), CONSTRAINT "FK_request_department" FOREIGN KEY ("departmentId") REFERENCES "department" ("id"))`,
    );
    await queryRunner.query(`DROP TABLE "request"`);
    await queryRunner.query(`ALTER TABLE "request_new" RENAME TO "request"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "request_old" ("id" varchar PRIMARY KEY NOT NULL, "title" text NOT NULL, "description" text NOT NULL, "submittedAt" datetime NOT NULL, "departmentId" varchar NOT NULL, "status" varchar CHECK( "status" IN ('Submitted','Approved','InProgress','Completed','Cancelled') ) NOT NULL, "assigneeId" varchar, "cancellationReason" text, "completedAt" datetime, "version" integer NOT NULL DEFAULT (1), CONSTRAINT "FK_request_department" FOREIGN KEY ("departmentId") REFERENCES "department" ("id"))`,
    );
    await queryRunner.query(`DROP TABLE "request"`);
    await queryRunner.query(`ALTER TABLE "request_old" RENAME TO "request"`);
  }
}
