import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRequestTable1789572634017 implements MigrationInterface {
  name = 'CreateRequestTable1789572634017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "request" ("id" varchar PRIMARY KEY NOT NULL, "title" text NOT NULL, "description" text NOT NULL, "submittedAt" datetime NOT NULL, "status" varchar CHECK( "status" IN ('Submitted','Approved','InProgress','Completed','Cancelled') ) NOT NULL, "assigneeId" varchar, "cancellationReason" text, "completedAt" datetime, "version" integer NOT NULL DEFAULT (1))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "request"`);
  }
}
