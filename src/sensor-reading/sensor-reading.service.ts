import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SensorReading } from './sensor-reading.entity';
import { CreateSensorReadingDto } from '../dto/create-sensor-reading.dto';
import { BatchCreateSensorReadingDto } from '../dto/batch-create-sensor-reading.dto';
import { Sensor } from '../sensor/sensor.entity';
import { Location } from '../location/location.entity';
import { SensorType } from '../sensor/sensor-type.entity';
import { PaginateSensorReadingQueryDto } from '../dto/paginate-sensor-reading-query.dto';
import { ExportSensorReadingQueryDto } from '../dto/export-sensor-reading-query.dto';
import { PaginatedResponse } from '../dto/pagination-response.interface';
import { SensorCacheService } from '../cache/sensor-cache.service';
import { SensorRealtimeStats } from '../dto/sensor-realtime-stats.dto';
import { SensorGateway } from '../websocket/sensor.gateway';

@Injectable()
export class SensorReadingService {
  constructor(
    @InjectRepository(SensorReading)
    private sensorReadingRepository: Repository<SensorReading>,
    @InjectRepository(Sensor)
    private sensorRepository: Repository<Sensor>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    @InjectRepository(SensorType)
    private sensorTypeRepository: Repository<SensorType>,
    private sensorCacheService: SensorCacheService,
    private sensorGateway: SensorGateway,
  ) {}

  async create(
    dto: CreateSensorReadingDto,
  ): Promise<{ saved: number; location: string }> {
    const locationName = dto.location.replace(/_/g, ' ');

    // OPTIMIZED: Use in-memory cache instead of DB query
    const location = this.sensorCacheService.getLocation(locationName);
    if (!location) {
      throw new NotFoundException(`Location "${dto.location}" not found`);
    }

    // OPTIMIZED: Get unique sensor types and validate from cache
    const uniqueSensorTypeNames = [
      ...new Set(dto.readings.map((r) => r.sensorType)),
    ];

    // Validate all sensor types exist
    for (const name of uniqueSensorTypeNames) {
      const sensorType = this.sensorCacheService.getSensorType(name);
      if (!sensorType) {
        throw new NotFoundException(`Sensor type "${name}" not found`);
      }
    }

    // OPTIMIZED: Build reading entities using cache lookup
    const readingEntities = dto.readings.map((item) => {
      const sensor = this.sensorCacheService.getSensor(
        1, // create() is single-location; defaults to mannequin 1
        item.sensorType,
        item.sensorNumber,
        locationName,
      );

      if (!sensor) {
        throw new NotFoundException(
          `Sensor not found for location "${dto.location}", type "${item.sensorType}", number ${item.sensorNumber}`,
        );
      }

      // Create sensor reference from cache
      const sensorRef = this.sensorReadingRepository.create({
        sensor: { id: sensor.id } as Sensor,
        value: item.value,
      });

      return sensorRef;
    });

    // Bulk insert — 1 query
    await this.sensorReadingRepository.save(readingEntities);

    const now = new Date();
    this.sensorGateway.emitBatchUpdate(
      dto.readings.map((item) => ({
        sensorType: item.sensorType,
        value: item.value,
        location: locationName,
        sensorNumber: item.sensorNumber,
        timestamp: now,
        mannequin_id: 1,
      })),
    );

    return { saved: readingEntities.length, location: locationName };
  }

  async batchCreate(
    dto: BatchCreateSensorReadingDto,
  ): Promise<{ saved: number; locations: string[] }> {
    const mid = dto.mannequinId ?? 1;

    // OPTIMIZED: Use cache for all lookups - 0 DB queries for validation
    const locationMap = new Map<string, number>(); // name -> id
    const uniqueLocations = [
      ...new Set(dto.readings.map((r) => r.location.replace(/_/g, ' '))),
    ];

    // Validate all locations from cache
    for (const locationName of uniqueLocations) {
      const location = this.sensorCacheService.getLocation(locationName);
      if (!location) {
        throw new NotFoundException(
          `Location "${locationName}" not found in cache. Available locations: ${Array.from(this.sensorCacheService['cache'].locations.keys()).join(', ')}`,
        );
      }
      locationMap.set(locationName, location.id);
    }

    // Validate all sensor types from cache
    const uniqueSensorTypeNames = [
      ...new Set(dto.readings.map((r) => r.sensorType)),
    ];

    for (const name of uniqueSensorTypeNames) {
      const sensorType = this.sensorCacheService.getSensorType(name);
      if (!sensorType) {
        throw new NotFoundException(
          `Sensor type "${name}" not found. Available types: ${Array.from(this.sensorCacheService['cache'].sensorTypes.keys()).join(', ')}`,
        );
      }
    }

    // Build all reading entities using cache (keyed by mannequin)
    const readingEntities = dto.readings.map((item) => {
      const locationName = item.location.replace(/_/g, ' ');
      const sensor = this.sensorCacheService.getSensor(
        mid,
        item.sensorType,
        item.sensorNumber,
        locationName,
      );

      if (!sensor) {
        const cacheKey = `${mid}-${item.sensorType}-${item.sensorNumber}-${locationName}`;
        const availableKeys = Array.from(
          this.sensorCacheService['cache'].sensors.keys(),
        ).filter((k) => k.startsWith(`${mid}-${item.sensorType}-`));

        throw new NotFoundException(
          `Sensor not found! Cache key: "${cacheKey}". ` +
            `Requested: mannequin=${mid}, type="${item.sensorType}", number=${item.sensorNumber}, location="${locationName}". ` +
            `Available sensors for this type: [${availableKeys.slice(0, 5).join(', ')}...]`,
        );
      }

      return this.sensorReadingRepository.create({
        sensor: { id: sensor.id } as Sensor,
        value: item.value,
      });
    });

    // Single bulk insert - 1 DB query for all sensors
    await this.sensorReadingRepository.save(readingEntities);

    const now = new Date();
    this.sensorGateway.emitBatchUpdate(
      dto.readings.map((item) => ({
        sensorType: item.sensorType,
        value: item.value,
        location: item.location.replace(/_/g, ' '),
        sensorNumber: item.sensorNumber,
        timestamp: now,
        mannequin_id: mid,
      })),
    );

    return {
      saved: readingEntities.length,
      locations: uniqueLocations,
    };
  }

  async findBySensorType(
    query: PaginateSensorReadingQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10, sensorType, sensorNumber, location, startDate, endDate, mannequin_id: mannequinId = 1 } =
      query;

    const skip = (page - 1) * limit;

    const queryBuilder =
      this.sensorReadingRepository
        .createQueryBuilder('reading')
        .leftJoinAndSelect('reading.sensor', 'sensor')
        .leftJoinAndSelect('sensor.sensorType', 'sensorType')
        .leftJoinAndSelect('sensor.location', 'location')
        .andWhere('sensor.mannequin_id = :mannequinId', { mannequinId });

    // Filter by sensor type
    if (sensorType) {
      queryBuilder.andWhere('sensorType.name = :sensorType', { sensorType });
    }

    // Filter by individual physical sensor (point number within location/type)
    if (sensorNumber) {
      queryBuilder.andWhere('sensor.externalId = :sensorNumber', { sensorNumber });
    }

    // Filter by location
    if (location) {
      const locationName = location.replace(/_/g, ' ');
      queryBuilder.andWhere('location.name = :location', {
        location: locationName,
      });
    }

    // Filter by date range
    if (startDate) {
      queryBuilder.andWhere('reading.timestamp >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      queryBuilder.andWhere('reading.timestamp <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    queryBuilder.orderBy('reading.timestamp', 'DESC');
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAvailableSensorTypes(): Promise<{ name: string; unit: string }[]> {
    // OPTIMIZED: Return from cache instead of DB query
    return this.sensorCacheService.getAllSensorTypes();
  }

  async getLatestReadingsPerSensorType(mannequinId: number = 1): Promise<SensorRealtimeStats[]> {
    const sensorTypes = this.sensorCacheService.getAllSensorTypes();
    const result: SensorRealtimeStats[] = [];

    for (const sensorType of sensorTypes) {
      const latestReading = await this.sensorReadingRepository
        .createQueryBuilder('reading')
        .leftJoin('reading.sensor', 'sensor')
        .leftJoin('sensor.sensorType', 'sensorType')
        .where('sensorType.name = :sensorTypeName', {
          sensorTypeName: sensorType.name,
        })
        .andWhere('sensor.mannequin_id = :mannequinId', { mannequinId })
        .orderBy('reading.timestamp', 'DESC')
        .limit(1)
        .getOne();

      if (latestReading) {
        result.push({
          sensorType: sensorType.name,
          unit: sensorType.unit,
          value: parseFloat(latestReading.value.toString()),
          timestamp: latestReading.timestamp,
        });
      } else {
        // No data yet for this sensor type
        result.push({
          sensorType: sensorType.name,
          unit: sensorType.unit,
          value: null,
          timestamp: null,
        });
      }
    }

    return result;
  }

  async getLastSeenByMannequin(mannequinId: number): Promise<Date | null> {
    const row = await this.sensorReadingRepository
      .createQueryBuilder('reading')
      .leftJoin('reading.sensor', 'sensor')
      .where('sensor.mannequin_id = :mannequinId', { mannequinId })
      .orderBy('reading.timestamp', 'DESC')
      .limit(1)
      .getOne();

    return row?.timestamp ?? null;
  }

  getCacheDebugInfo() {
    const cache = this.sensorCacheService['cache'];

    return {
      locations: Array.from(cache.locations.entries()).map(([name, data]) => ({
        name,
        id: data.id,
      })),
      sensorTypes: Array.from(cache.sensorTypes.entries()).map(
        ([name, data]) => ({
          name,
          id: data.id,
          unit: data.unit,
        }),
      ),
      sensorCount: cache.sensors.size,
      sampleSensors: Array.from(cache.sensors.entries())
        .slice(0, 10)
        .map(([key, sensor]) => ({
          key,
          ...sensor,
        })),
      totalLocations: cache.locations.size,
      totalSensorTypes: cache.sensorTypes.size,
    };
  }

  async getReadingsBySensorType(
    sensorTypeName: string,
    query: PaginateSensorReadingQueryDto,
  ): Promise<PaginatedResponse<any>> {
    // OPTIMIZED: Validate sensor type from cache
    const sensorType = this.sensorCacheService.getSensorType(sensorTypeName);

    if (!sensorType) {
      throw new NotFoundException(
        `Sensor type "${sensorTypeName}" not found`,
      );
    }

    const { page = 1, limit = 10, sensorNumber, location, startDate, endDate } = query;

    const skip = (page - 1) * limit;

    const queryBuilder = this.sensorReadingRepository
      .createQueryBuilder('reading')
      .leftJoinAndSelect('reading.sensor', 'sensor')
      .leftJoinAndSelect('sensor.sensorType', 'sensorType')
      .leftJoinAndSelect('sensor.location', 'location')
      .where('sensorType.id = :sensorTypeId', { sensorTypeId: sensorType.id });

    // Filter by individual physical sensor (point number within location/type)
    if (sensorNumber) {
      queryBuilder.andWhere('sensor.externalId = :sensorNumber', { sensorNumber });
    }

    // Filter by location
    if (location) {
      const locationName = location.replace(/_/g, ' ');
      queryBuilder.andWhere('location.name = :location', {
        location: locationName,
      });
    }

    // Filter by date range
    if (startDate) {
      queryBuilder.andWhere('reading.timestamp >= :startDate', {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      queryBuilder.andWhere('reading.timestamp <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    // Order by timestamp descending (newest first)
    queryBuilder.orderBy('reading.timestamp', 'DESC');

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  // Danger thresholds per sensor type (mirrors the frontend SENSOR_META limits)
  private static readonly DANGER_THRESHOLD: Record<string, number> = {
    temperature: 38,
    pressure: 70,
    vibration: 3,
    flex: 105000,
    strain: 20000,
  };

  private escapeCsv(value: string | number): string {
    return `"${String(value).replace(/"/g, '""')}"`;
  }

  async exportReadingsCsv(query: ExportSensorReadingQueryDto): Promise<string> {
    const { date, mannequin_id: mannequinId = 1, sensorType, location } = query;

    // Single calendar day → [00:00:00.000, 23:59:59.999] in server local time
    const startDate = new Date(`${date}T00:00:00.000`);
    const endDate = new Date(`${date}T23:59:59.999`);

    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException(`Invalid date "${date}"`);
    }

    const queryBuilder = this.sensorReadingRepository
      .createQueryBuilder('reading')
      .leftJoinAndSelect('reading.sensor', 'sensor')
      .leftJoinAndSelect('sensor.sensorType', 'sensorType')
      .leftJoinAndSelect('sensor.location', 'location')
      .leftJoinAndSelect('sensor.mannequin', 'mannequin')
      .where('sensor.mannequin_id = :mannequinId', { mannequinId })
      .andWhere('reading.timestamp >= :startDate', { startDate })
      .andWhere('reading.timestamp <= :endDate', { endDate });

    if (sensorType) {
      queryBuilder.andWhere('sensorType.name = :sensorType', { sensorType });
    }

    if (location) {
      const locationName = location.replace(/_/g, ' ');
      queryBuilder.andWhere('location.name = :location', {
        location: locationName,
      });
    }

    // Chronological order is friendlier for an exported log
    queryBuilder.orderBy('reading.timestamp', 'ASC');

    const rows = await queryBuilder.getMany();

    const header = [
      'No',
      'Timestamp',
      'Mannequin',
      'Location',
      'Sensor Type',
      'Sensor No',
      'Value',
      'Unit',
      'Status',
    ];

    const lines: string[] = [
      header.map((h) => this.escapeCsv(h)).join(','),
    ];

    rows.forEach((reading, index) => {
      const typeName = reading.sensor?.sensorType?.name ?? '';
      const value = Number(reading.value);
      const threshold = SensorReadingService.DANGER_THRESHOLD[typeName];
      const status =
        Number.isFinite(value) && Number.isFinite(threshold) && value > threshold
          ? 'OVER'
          : 'OK';

      const cells = [
        index + 1,
        new Date(reading.timestamp).toISOString(),
        reading.sensor?.mannequin?.name ?? `Mannequin ${mannequinId}`,
        reading.sensor?.location?.name ?? '',
        typeName,
        reading.sensor?.externalId ?? '',
        Number.isFinite(value) ? value : '',
        reading.sensor?.sensorType?.unit ?? '',
        status,
      ];

      lines.push(cells.map((c) => this.escapeCsv(c)).join(','));
    });

    // Prepend BOM (U+FEFF) so Excel reads UTF-8 (°C, µε, Ω) correctly
    const bom = String.fromCharCode(0xfeff);
    return bom + lines.join('\r\n');
  }
}
