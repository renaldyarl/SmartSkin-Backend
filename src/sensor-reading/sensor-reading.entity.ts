import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Sensor } from '../sensor/sensor.entity';

@Entity('sensor_reading') 
export class SensorReading {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sensor, (sensor) => sensor.readings, { nullable: false })
  @JoinColumn({ name: 'sensor_id' })
  sensor: Sensor;

  @Column('numeric', { precision: 10, scale: 4 })
  value: number;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;
}