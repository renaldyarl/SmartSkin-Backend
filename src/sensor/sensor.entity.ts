import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Location } from '../location/location.entity';
import { SensorType } from '../sensor/sensor-type.entity';
import { SensorReading } from '../sensor-reading/sensor-reading.entity';
import { Mannequin } from '../mannequin/mannequin.entity';

@Entity()
export class Sensor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  externalId: number;

  @ManyToOne(() => SensorType, (type) => type.sensors)
  @JoinColumn({ name: 'sensor_type_id' })
  sensorType: SensorType;

  @ManyToOne(() => Location, (location) => location.sensors)
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @ManyToOne(() => Mannequin, (mannequin) => mannequin.sensors, { nullable: true })
  @JoinColumn({ name: 'mannequin_id' })
  mannequin: Mannequin;

  @Column({ name: 'mannequin_id', nullable: true, type: 'int' })
  mannequinId: number;

  @OneToMany(() => SensorReading, (reading) => reading.sensor)
  readings: SensorReading[];
}