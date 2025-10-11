import { MigrationInterface, QueryRunner } from "typeorm";

export class InitMigration1760171876792 implements MigrationInterface {
    
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table exists dulu
        const tableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'sensor_reading'
            );
        `);

        if (!tableExists[0].exists) {
            await queryRunner.query(`
                CREATE TABLE sensor_reading (
                    id SERIAL PRIMARY KEY,
                    value FLOAT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS sensor_reading;`);
    }
}