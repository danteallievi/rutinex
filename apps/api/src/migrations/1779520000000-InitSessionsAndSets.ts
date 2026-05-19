import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSessionsAndSets1779520000000 implements MigrationInterface {
  name = 'InitSessionsAndSets1779520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- sessions ----------------------------------------------------------
    await queryRunner.query(
      `CREATE TABLE "sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "assignment_id" uuid NOT NULL,
        "routine_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "routine_snapshot" jsonb NOT NULL,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "pk_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "fk_sessions_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_sessions_assignment" FOREIGN KEY ("assignment_id")
          REFERENCES "assignments" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_sessions_routine" FOREIGN KEY ("routine_id")
          REFERENCES "routines" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_sessions_student" FOREIGN KEY ("student_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sessions_tenant_id" ON "sessions" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sessions_assignment_id" ON "sessions" ("assignment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sessions_routine_id" ON "sessions" ("routine_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sessions_student_id" ON "sessions" ("student_id")`,
    );
    // 1 sesión abierta por (assignment). ADR-026 §4.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_sessions_assignment_open" ON "sessions" ("assignment_id") WHERE "completed_at" IS NULL`,
    );

    // ---- sets --------------------------------------------------------------
    await queryRunner.query(
      `CREATE TABLE "sets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "routine_item_id" uuid,
        "exercise_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "set_number" integer NOT NULL,
        "reps" integer NOT NULL,
        "weight_kg" numeric(6,2),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_sets" PRIMARY KEY ("id"),
        CONSTRAINT "fk_sets_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_sets_session" FOREIGN KEY ("session_id")
          REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "fk_sets_routine_item" FOREIGN KEY ("routine_item_id")
          REFERENCES "routine_items" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "fk_sets_exercise" FOREIGN KEY ("exercise_id")
          REFERENCES "exercises" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_sets_student" FOREIGN KEY ("student_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sets_tenant_id" ON "sets" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sets_session_id" ON "sets" ("session_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sets_routine_item_id" ON "sets" ("routine_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sets_exercise_id" ON "sets" ("exercise_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_sets_student_id" ON "sets" ("student_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."ix_sets_student_id"`);
    await queryRunner.query(`DROP INDEX "public"."ix_sets_exercise_id"`);
    await queryRunner.query(`DROP INDEX "public"."ix_sets_routine_item_id"`);
    await queryRunner.query(`DROP INDEX "public"."ix_sets_session_id"`);
    await queryRunner.query(`DROP INDEX "public"."ix_sets_tenant_id"`);
    await queryRunner.query(`DROP TABLE "sets"`);

    await queryRunner.query(
      `DROP INDEX "public"."uq_sessions_assignment_open"`,
    );
    await queryRunner.query(`DROP INDEX "public"."ix_sessions_student_id"`);
    await queryRunner.query(`DROP INDEX "public"."ix_sessions_routine_id"`);
    await queryRunner.query(`DROP INDEX "public"."ix_sessions_assignment_id"`);
    await queryRunner.query(`DROP INDEX "public"."ix_sessions_tenant_id"`);
    await queryRunner.query(`DROP TABLE "sessions"`);
  }
}
