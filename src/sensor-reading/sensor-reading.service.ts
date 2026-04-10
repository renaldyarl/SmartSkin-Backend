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
import { PaginatedResponse } from '../dto/pagination-response.interface';
import { SensorCacheService } from '../cache/sensor-cache.service';
import { SensorRealtimeStats } from '../dto/sensor-realtime-stats.dto';

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

    return { saved: readingEntities.length, location: locationName };
  }

  async batchCreate(
    dto: BatchCreateSensorReadingDto,
  ): Promise<{ saved: number; locations: string[] }> {
    // OPTIMIZED: Use cache for all lookups - 0 DB queries for validation
    const locationMap = new Map<string, number>(); // name -> id
    const uniqueLocations = [
      ...new Set(dto.readings.map((r) => r.location.replace(/_/g, ' '))),
    ];

    // Validate all locations from cache
    for (const locationName of uniqueLocations) {
      const location = this.sensorCacheService.getLocation(locationName);
      if (!location) {
        throw new NotFoundException(`Location "${locationName}" not found`);
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
        throw new NotFoundException(`Sensor type "${name}" not found`);
      }
    }

    // Build all reading entities using cache
    const readingEntities = dto.readings.map((item) => {
      const locationName = item.location.replace(/_/g, ' ');
      const sensor = this.sensorCacheService.getSensor(
        item.sensorType,
        item.sensorNumber,
        locationName,
      );

      if (!sensor) {
        throw new NotFoundException(
          `Sensor not found for location "${item.location}", type "${item.sensorType}", number ${item.sensorNumber}`,
        );
      }

      return this.sensorReadingRepository.create({
        sensor: { id: sensor.id } as Sensor,
        value: item.value,
      });
    });

    // Single bulk insert - 1 DB query for all 42 sensors
    await this.sensorReadingRepository.save(readingEntities);

    return {
      saved: readingEntities.length,
      locations: uniqueLocations,
    };
  }

  async findBySensorType(
    query: PaginateSensorReadingQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10, sensorType, location, startDate, endDate } =
      query;

    const skip = (page - 1) * limit;

    const queryBuilder =
      this.sensorReadingRepository
        .createQueryBuilder('reading')
        .leftJoinAndSelect('reading.sensor', 'sensor')
        .leftJoinAndSelect('sensor.sensorType', 'sensorType')
        .leftJoinAndSelect('sensor.location', 'location');

    // Filter by sensor type
    if (sensorType) {
      queryBuilder.andWhere('sensorType.name = :sensorType', { sensorType });
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

  async getAvailableSensorTypes(): Promise<{ name: string; unit: string }[]> {
    // OPTIMIZED: Return from cache instead of DB query
    return this.sensorCacheService.getAllSensorTypes();
  }

  async getLatestReadingsPerSensorType(): Promise<SensorRealtimeStats[]> {
    const sensorTypes = this.sensorCacheService.getAllSensorTypes();
    const result: SensorRealtimeStats[] = [];

    for (const sensorType of sensorTypes) {
      // Get the latest reading for this sensor type
      const latestReading = await this.sensorReadingRepository
        .createQueryBuilder('reading')
        .leftJoin('reading.sensor', 'sensor')
        .leftJoin('sensor.sensorType', 'sensorType')
        .where('sensorType.name = :sensorTypeName', {
          sensorTypeName: sensorType.name,
        })
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

    const { page = 1, limit = 10, location, startDate, endDate } = query;

    const skip = (page - 1) * limit;

    const queryBuilder = this.sensorReadingRepository
      .createQueryBuilder('reading')
      .leftJoinAndSelect('reading.sensor', 'sensor')
      .leftJoinAndSelect('sensor.sensorType', 'sensorType')
      .leftJoinAndSelect('sensor.location', 'location')
      .where('sensorType.id = :sensorTypeId', { sensorTypeId: sensorType.id });

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
}
