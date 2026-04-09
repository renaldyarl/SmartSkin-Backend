import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SensorReading } from './sensor-reading.entity';
import { CreateSensorReadingDto } from '../dto/create-sensor-reading.dto';
import { Sensor } from '../sensor/sensor.entity';
import { Location } from '../location/location.entity';
import { SensorType } from '../sensor/sensor-type.entity';
import { PaginateSensorReadingQueryDto } from '../dto/paginate-sensor-reading-query.dto';
import { PaginatedResponse } from '../dto/pagination-response.interface';

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
  ) {}

  async create(
    dto: CreateSensorReadingDto,
  ): Promise<{ saved: number; location: string }> {
    const locationName = dto.location.replace(/_/g, ' ');

    // 1. Ambil location — 1 query
    const location = await this.locationRepository.findOne({
      where: { name: locationName },
    });
    if (!location) {
      throw new NotFoundException(`Location "${dto.location}" not found`);
    }

    // 2. Ambil semua unique sensorType sekaligus — 1 query
    const uniqueSensorTypeNames = [
      ...new Set(dto.readings.map((r) => r.sensorType)),
    ];
    const sensorTypes = await this.sensorTypeRepository.find({
      where: { name: In(uniqueSensorTypeNames) },
    });

    const sensorTypeMap = new Map(sensorTypes.map((st) => [st.name, st]));
    for (const name of uniqueSensorTypeNames) {
      if (!sensorTypeMap.has(name)) {
        throw new NotFoundException(`Sensor type "${name}" not found`);
      }
    }

    // 3. Ambil semua sensor yang relevan — 1 query
    const sensorTypeIds = sensorTypes.map((st) => st.id);
    const sensors = await this.sensorRepository.find({
      where: {
        location: { id: location.id },
        sensorType: { id: In(sensorTypeIds) },
      },
      relations: ['sensorType'],
    });

    // Lookup map: "sensorTypeName-sensorNumber" -> Sensor
    const sensorMap = new Map(
      sensors.map((s) => [`${s.sensorType.name}-${s.externalId}`, s]),
    );

    // 4. Bangun semua reading entity
    const readingEntities = dto.readings.map((item) => {
      const key = `${item.sensorType}-${item.sensorNumber}`;
      const sensor = sensorMap.get(key);

      if (!sensor) {
        throw new NotFoundException(
          `Sensor not found for location "${dto.location}", type "${item.sensorType}", number ${item.sensorNumber}`,
        );
      }

      return this.sensorReadingRepository.create({
        sensor,
        value: item.value,
      });
    });

    // 5. Bulk insert — 1 query
    await this.sensorReadingRepository.save(readingEntities);

    return { saved: readingEntities.length, location: locationName };
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
    const sensorTypes = await this.sensorTypeRepository
      .createQueryBuilder('sensorType')
      .select(['sensorType.name', 'sensorType.unit'])
      .getMany();

    return sensorTypes;
  }

  async getReadingsBySensorType(
    sensorTypeName: string,
    query: PaginateSensorReadingQueryDto,
  ): Promise<PaginatedResponse<any>> {
    // Validate sensor type exists
    const sensorType = await this.sensorTypeRepository.findOne({
      where: { name: sensorTypeName },
    });

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
