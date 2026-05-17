import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitUsers1779120000000 implements MigrationInterface {
  name = 'InitUsers1779120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM ('OWNER', 'TRAINER', 'STUDENT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "email" character varying(255),
        "password_hash" character varying(255),
        "must_change_password" boolean NOT NULL DEFAULT false,
        "is_superadmin" boolean NOT NULL DEFAULT false,
        "first_name" character varying(100) NOT NULL,
        "last_name" character varying(100) NOT NULL,
        "dni" character varying(20),
        "role" "public"."user_role",
        "trainer_id" uuid,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "fk_users_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "fk_users_trainer" FOREIGN KEY ("trainer_id")
          REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_users_tenant_id" ON "users" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_tenant_email" ON "users" ("tenant_id", "email")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_tenant_dni" ON "users" ("tenant_id", "dni")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_email_global_unique" ON "users" ("email") WHERE "tenant_id" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."users_email_global_unique"`);
    await queryRunner.query(`DROP INDEX "public"."uq_users_tenant_dni"`);
    await queryRunner.query(`DROP INDEX "public"."uq_users_tenant_email"`);
    await queryRunner.query(`DROP INDEX "public"."ix_users_tenant_id"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
  }
}
