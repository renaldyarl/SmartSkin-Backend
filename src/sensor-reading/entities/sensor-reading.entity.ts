import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('sensor_readings')
export class SensorReading {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sensor_id: number;

  @Column('double precision')
  value: number;

  @CreateDateColumn()
  timestamp: Date;
}
