import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUser1760171876795 implements MigrationInterface {
  name = 'AddUser1760171876795';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Table is "app_user" — "user" is a reserved word in Postgres.
    await queryRunner.query(`
      CREATE TABLE app_user (
        id            SERIAL PRIMARY KEY,
        username      VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name  VARCHAR(150),
        role          VARCHAR(50) NOT NULL DEFAULT 'admin',
        created_at    TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_app_user_username ON app_user(username)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_app_user_username`);
    await queryRunner.query(`DROP TABLE IF EXISTS app_user`);
  }
}
