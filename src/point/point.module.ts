import { Module } from '@nestjs/common';
import { PointController } from './point.controller';
import { PointService } from './point.service';
import { PointRepository } from './point.repository';
import { DatabaseModule } from 'src/database/database.module';

/**
 * Point Module
 * - Controller, Service, Repository 등록
 * - 의존성 주입 설정
 */
@Module({
  imports: [DatabaseModule],
  controllers: [PointController],
  providers: [
    PointService,
    {
      provide: 'IPointRepository',
      useClass: PointRepository,
    },
  ],
})
export class PointModule {}
