import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitPersonalRecords1779600000000 implements MigrationInterface {
  name = 'InitPersonalRecords1779600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."personal_record_type" AS ENUM ('max_weight', 'max_reps_at_weight', 'max_volume')`,
    );
    await queryRunner.query(
      `CREATE TABLE "personal_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "exercise_id" uuid NOT NULL,
        "record_type" "public"."personal_record_type" NOT NULL,
        "weight_kg" numeric(6,2) NOT NULL,
        "reps" integer NOT NULL,
        "achieved_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "set_id" uuid NOT NULL,
        CONSTRAINT "pk_personal_records" PRIMARY KEY ("id"),
        CONSTRAINT "fk_personal_records_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_personal_records_student" FOREIGN KEY ("student_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_personal_records_exercise" FOREIGN KEY ("exercise_id")
          REFERENCES "exercises" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_personal_records_set" FOREIGN KEY ("set_id")
          REFERENCES "sets" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_personal_records_tenant_id" ON "personal_records" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_personal_records_student_id" ON "personal_records" ("student_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_personal_records_exercise_id" ON "personal_records" ("exercise_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_personal_records_set_id" ON "personal_records" ("set_id")`,
    );
    // UNIQUE compuesto que sirve como conflict target del ON CONFLICT del
    // UPSERT atómico (ADR-027 §4).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_personal_records_target" ON "personal_records" ("tenant_id", "student_id", "exercise_id", "record_type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_personal_records_target"`);
    await queryRunner.query(`DROP INDEX "public"."ix_personal_records_set_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."ix_personal_records_exercise_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_personal_records_student_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_personal_records_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE "personal_records"`);
    await queryRunner.query(`DROP TYPE "public"."personal_record_type"`);
  }
}
