import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitRefreshTokens1779200000000 implements MigrationInterface {
  name = 'InitRefreshTokens1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid,
        "user_id" uuid NOT NULL,
        "token_hash" character varying(64) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "replaced_by" uuid,
        "user_agent" character varying(255),
        "ip" character varying(45),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "fk_refresh_tokens_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "fk_refresh_tokens_replaced_by" FOREIGN KEY ("replaced_by")
          REFERENCES "refresh_tokens" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_refresh_tokens_tenant_id" ON "refresh_tokens" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."ix_refresh_tokens_expires_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_refresh_tokens_token_hash"`,
    );
    await queryRunner.query(`DROP INDEX "public"."ix_refresh_tokens_user_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."ix_refresh_tokens_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}
