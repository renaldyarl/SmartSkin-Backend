import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, IntegerType } from 'typeorm';

@Entity('sensor_readings')
export class SensorReading {
  @PrimaryGeneratedColumn()
  sensor_id: number;

  @Column({ name: 'id', type: 'integer', nullable: true })
  id: number;

  @Column({ type: 'float', nullable: true })
  value: number;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamp' })
  createdAt: Date;
}
