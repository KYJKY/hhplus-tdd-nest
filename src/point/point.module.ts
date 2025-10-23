import { Module } from '@nestjs/common';
import { PointController } from './point.controller';
import { PointService } from './point.service';
import { PointRepository } from './point.repository';
import { LockManager } from './lock-manager';
import { DatabaseModule } from 'src/database/database.module';

/**
 * Point Module
 * - Controller, Service, Repository 등록
 * - 의존성 주입 설정
 * - LockManager로 동시성 제어
 */
@Module({
  imports: [DatabaseModule],
  controllers: [PointController],
  providers: [
    PointService,
    LockManager,
    {
      provide: 'IPointRepository',
      useClass: PointRepository,
    },
  ],
})
export class PointModule {}
