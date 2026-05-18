import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitExercises1779280000000 implements MigrationInterface {
  name = 'InitExercises1779280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."exercise_media_type" AS ENUM ('video', 'gif', 'image', 'none')`,
    );
    await queryRunner.query(
      `CREATE TABLE "exercises" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "media_url" character varying(1024),
        "media_type" "public"."exercise_media_type" NOT NULL DEFAULT 'none',
        "muscle_groups" text[] NOT NULL DEFAULT '{}',
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_exercises" PRIMARY KEY ("id"),
        CONSTRAINT "fk_exercises_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_exercises_created_by" FOREIGN KEY ("created_by")
          REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_exercises_tenant_id" ON "exercises" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_exercises_muscle_groups" ON "exercises" USING GIN ("muscle_groups")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."ix_exercises_muscle_groups"`);
    await queryRunner.query(`DROP INDEX "public"."ix_exercises_tenant_id"`);
    await queryRunner.query(`DROP TABLE "exercises"`);
    await queryRunner.query(`DROP TYPE "public"."exercise_media_type"`);
  }
}
