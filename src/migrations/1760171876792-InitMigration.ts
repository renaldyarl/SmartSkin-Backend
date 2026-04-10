import { MigrationInterface, QueryRunner } from "typeorm";

export class InitMigration1760171876792 implements MigrationInterface {
  name = "InitMigration1760171876792";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
  CREATE TABLE sensor_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    unit VARCHAR(20)
  );
`);

    await queryRunner.query(`
  CREATE TABLE location (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
  );
`);

    await queryRunner.query(`
  CREATE TABLE sensor (
    id SERIAL PRIMARY KEY,
    sensor_type_id INT NOT NULL,
    location_id INT,
    external_id INT NOT NULL,
    CONSTRAINT fk_sensor_type FOREIGN KEY (sensor_type_id)
      REFERENCES sensor_type(id) ON DELETE CASCADE,
    CONSTRAINT fk_sensor_location FOREIGN KEY (location_id)
      REFERENCES location(id) ON DELETE SET NULL
  );
`);

    await queryRunner.query(`
  CREATE TABLE sensor_reading (
    id SERIAL PRIMARY KEY,
    sensor_id INT NOT NULL,
    value DECIMAL(10,4) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_sensor_reading_sensor FOREIGN KEY (sensor_id)
      REFERENCES sensor(id) ON DELETE CASCADE
  );
`);

    await queryRunner.query(
      `CREATE INDEX idx_sensor_reading_sensor_id ON sensor_reading(sensor_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_sensor_reading_timestamp ON sensor_reading(timestamp)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE sensor_reading`);
    await queryRunner.query(`DROP TABLE sensor`);
    await queryRunner.query(`DROP TABLE location`);
    await queryRunner.query(`DROP TABLE sensor_type`);
  }
}
