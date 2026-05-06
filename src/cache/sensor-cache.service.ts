import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../location/location.entity';
import { SensorType } from '../sensor/sensor-type.entity';
import { Sensor } from '../sensor/sensor.entity';

export interface CachedSensor {
  id: number;
  externalId: number;
  sensorTypeName: string;
  locationName: string;
  mannequinId: number;
}

export interface CacheData {
  locations: Map<string, { id: number; name: string }>;
  sensorTypes: Map<string, { id: number; name: string; unit: string }>;
  sensors: Map<string, CachedSensor>; // key: "mannequinId-sensorTypeName-externalId-locationName"
}

@Injectable()
export class SensorCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SensorCacheService.name);
  private cache: CacheData = {
    locations: new Map(),
    sensorTypes: new Map(),
    sensors: new Map(),
  };
  private refreshInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(SensorType)
    private sensorTypeRepository: Repository<SensorType>,
    @InjectRepository(Sensor)
    private sensorRepository: Repository<Sensor>,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing sensor cache...');
    await this.refreshCache();
    this.logger.log('Sensor cache initialized successfully');

    // Refresh cache every 5 minutes
    this.refreshInterval = setInterval(() => {
      this.refreshCache().catch((err) =>
        this.logger.error('Cache refresh failed:', err),
      );
    }, 5 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async refreshCache() {
    try {
      this.logger.log('Refreshing sensor cache...');

      const locations = await this.locationRepository.find();
      this.cache.locations = new Map(
        locations.map((loc) => [loc.name, { id: loc.id, name: loc.name }]),
      );

      const sensorTypes = await this.sensorTypeRepository.find();
      this.cache.sensorTypes = new Map(
        sensorTypes.map((st) => [
          st.name,
          { id: st.id, name: st.name, unit: st.unit },
        ]),
      );

      // Load sensors with mannequin relation for per-mannequin cache keys
      const sensors = await this.sensorRepository.find({
        relations: ['sensorType', 'location', 'mannequin'],
      });

      this.cache.sensors = new Map();
      for (const sensor of sensors) {
        const mid = sensor.mannequin?.id ?? sensor.mannequinId ?? 1;
        const key = `${mid}-${sensor.sensorType.name}-${sensor.externalId}-${sensor.location?.name}`;
        this.cache.sensors.set(key, {
          id: sensor.id,
          externalId: sensor.externalId,
          sensorTypeName: sensor.sensorType.name,
          locationName: sensor.location?.name,
          mannequinId: mid,
        });
      }

      this.logger.log(
        `Cache refreshed: ${this.cache.locations.size} locations, ` +
          `${this.cache.sensorTypes.size} sensor types, ` +
          `${this.cache.sensors.size} sensors`,
      );
    } catch (error) {
      this.logger.error('Failed to refresh cache:', error);
    }
  }

  getLocation(name: string): { id: number; name: string } | undefined {
    return this.cache.locations.get(name);
  }

  getSensorType(
    name: string,
  ): { id: number; name: string; unit: string } | undefined {
    return this.cache.sensorTypes.get(name);
  }

  getSensor(
    mannequinId: number,
    sensorTypeName: string,
    externalId: number,
    locationName: string,
  ): CachedSensor | undefined {
    const key = `${mannequinId}-${sensorTypeName}-${externalId}-${locationName}`;
    return this.cache.sensors.get(key);
  }

  getAllSensorTypes(): { name: string; unit: string }[] {
    return Array.from(this.cache.sensorTypes.values()).map((st) => ({
      name: st.name,
      unit: st.unit,
    }));
  }
}
