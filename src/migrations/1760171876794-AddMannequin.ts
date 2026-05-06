import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMannequin1760171876794 implements MigrationInterface {
  name = 'AddMannequin1760171876794';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE mannequin (
        id   SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL
      )
    `);

    await queryRunner.query(`
      ALTER TABLE sensor ADD COLUMN mannequin_id INT
    `);

    await queryRunner.query(`
      ALTER TABLE sensor
        ADD CONSTRAINT fk_sensor_mannequin
        FOREIGN KEY (mannequin_id) REFERENCES mannequin(id) ON DELETE CASCADE
    `);

    await queryRunner.query(`
      CREATE INDEX idx_sensor_mannequin ON sensor(mannequin_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sensor_mannequin`);
    await queryRunner.query(
      `ALTER TABLE sensor DROP CONSTRAINT IF EXISTS fk_sensor_mannequin`,
    );
    await queryRunner.query(`ALTER TABLE sensor DROP COLUMN IF EXISTS mannequin_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS mannequin`);
  }
}
