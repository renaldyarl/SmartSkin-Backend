import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExternalIdToSensor1735135600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sensor ADD COLUMN external_id INTEGER
    `);
    await queryRunner.query(`
      UPDATE sensor SET external_id = id WHERE external_id IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE sensor ALTER COLUMN external_id SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sensor DROP COLUMN external_id
    `);
  }
}