import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1760171876793 implements MigrationInterface {
  name = 'AddPerformanceIndexes1760171876793';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Index for location lookup by name (used in every write request)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_location_name ON location(name)`,
    );

    // Index for sensor_type lookup by name (used in every write request)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_sensor_type_name ON sensor_type(name)`,
    );

    // Composite index for sensor lookup by type and location
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_sensor_type_location ON sensor(sensor_type_id, location_id)`,
    );

    // Composite index for sensor_reading: optimize time-series queries
    // This is critical for pagination queries that filter by sensor and date range
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_sensor_reading_sensor_timestamp ON sensor_reading(sensor_id, timestamp DESC)`,
    );

    // Index for sensor_reading timestamp alone (for date range queries without sensor filter)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_sensor_reading_timestamp_only ON sensor_reading(timestamp DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_sensor_reading_timestamp_only`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_sensor_reading_sensor_timestamp`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_sensor_type_location`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_sensor_type_name`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_location_name`);
  }
}
