import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAssignments1779440000000 implements MigrationInterface {
  name = 'InitAssignments1779440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "assignments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "routine_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "assigned_by" uuid NOT NULL,
        "starts_on" date NOT NULL,
        "ends_on" date,
        "weekday_mask" integer NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_assignments" PRIMARY KEY ("id"),
        CONSTRAINT "fk_assignments_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_assignments_routine" FOREIGN KEY ("routine_id")
          REFERENCES "routines" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_assignments_student" FOREIGN KEY ("student_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_assignments_assigned_by" FOREIGN KEY ("assigned_by")
          REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_assignments_tenant_id" ON "assignments" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_assignments_routine_id" ON "assignments" ("routine_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_assignments_student_id" ON "assignments" ("student_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_assignments_assigned_by" ON "assignments" ("assigned_by")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."ix_assignments_assigned_by"`);
    await queryRunner.query(`DROP INDEX "public"."ix_assignments_student_id"`);
    await queryRunner.query(`DROP INDEX "public"."ix_assignments_routine_id"`);
    await queryRunner.query(`DROP INDEX "public"."ix_assignments_tenant_id"`);
    await queryRunner.query(`DROP TABLE "assignments"`);
  }
}
