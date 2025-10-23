import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  ValidationPipe,
} from '@nestjs/common';
import { PointHistory, UserPoint } from './point.model';
import { ChargePointDto, UsePointDto } from './point.dto';
import { PointService } from './point.service';

/**
 * Point Controller
 * - HTTP 요청 처리
 * - Service에 비즈니스 로직 위임
 * - 파라미터 파싱 및 검증
 */
@Controller('/point')
export class PointController {
  constructor(private readonly pointService: PointService) {}

  /**
   * 특정 유저의 포인트 조회
   * GET /point/:id
   */
  @Get(':id')
  async point(@Param('id', ParseIntPipe) id: number): Promise<UserPoint> {
    return await this.pointService.getPoint(id);
  }

  /**
   * 특정 유저의 포인트 충전/이용 내역 조회
   * GET /point/:id/histories
   */
  @Get(':id/histories')
  async history(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PointHistory[]> {
    return await this.pointService.getPointHistories(id);
  }

  /**
   * 특정 유저의 포인트 충전
   * PATCH /point/:id/charge
   */
  @Patch(':id/charge')
  async charge(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) pointDto: ChargePointDto,
  ): Promise<UserPoint> {
    return await this.pointService.chargePoint(id, pointDto.amount);
  }

  /**
   * 특정 유저의 포인트 사용
   * PATCH /point/:id/use
   */
  @Patch(':id/use')
  async use(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) pointDto: UsePointDto,
  ): Promise<UserPoint> {
    return await this.pointService.usePoint(id, pointDto.amount);
  }
}
