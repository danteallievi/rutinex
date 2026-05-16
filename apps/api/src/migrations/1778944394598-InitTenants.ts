import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitTenants1778944394598 implements MigrationInterface {
  name = 'InitTenants1778944394598';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "tenants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying(63) NOT NULL,
        "name" character varying(255) NOT NULL,
        "branding" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_tenants" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tenants_slug" ON "tenants" ("slug")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_tenants_slug"`);
    await queryRunner.query(`DROP TABLE "tenants"`);
  }
}
