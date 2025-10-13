import { MigrationInterface, QueryRunner } from "typeorm";

export class InitMigration1760171876792 implements MigrationInterface {
    
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'sensor_readings'
            );
        `)

        if (!tableExists[0].exists) {
            await queryRunner.query(`
                CREATE TABLE sensor_readings (
                    id SERIAL PRIMARY KEY,
                    sensor_id INT NOT NULL,
                    value FLOAT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS sensor_readings;`);
    }
}