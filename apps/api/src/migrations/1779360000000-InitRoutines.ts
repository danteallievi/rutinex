import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitRoutines1779360000000 implements MigrationInterface {
  name = 'InitRoutines1779360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "routines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_routines" PRIMARY KEY ("id"),
        CONSTRAINT "fk_routines_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_routines_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_routines_tenant_id" ON "routines" ("tenant_id")`,
    );

    await queryRunner.query(
      `CREATE TABLE "routine_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "routine_id" uuid NOT NULL,
        "exercise_id" uuid NOT NULL,
        "position" integer NOT NULL,
        "prescribed_sets" integer NOT NULL,
        "prescribed_reps" character varying(50) NOT NULL,
        "prescribed_weight" character varying(50),
        "rest_seconds" integer,
        "notes" text,
        CONSTRAINT "pk_routine_items" PRIMARY KEY ("id"),
        CONSTRAINT "fk_routine_items_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_routine_items_routine" FOREIGN KEY ("routine_id")
          REFERENCES "routines" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "fk_routine_items_exercise" FOREIGN KEY ("exercise_id")
          REFERENCES "exercises" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_routine_items_tenant_id" ON "routine_items" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_routine_items_routine_id" ON "routine_items" ("routine_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_routine_items_exercise_id" ON "routine_items" ("exercise_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_routine_items_routine_position" ON "routine_items" ("routine_id", "position")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."uq_routine_items_routine_position"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_routine_items_exercise_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_routine_items_routine_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."ix_routine_items_tenant_id"`);
    await queryRunner.query(`DROP TABLE "routine_items"`);
    await queryRunner.query(`DROP INDEX "public"."ix_routines_tenant_id"`);
    await queryRunner.query(`DROP TABLE "routines"`);
  }
}
