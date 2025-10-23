import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { UserPoint, PointHistory, TransactionType } from './point.model';
import { IPointRepository } from './point.repository.interface';

/**
 * Point Service
 * - 포인트 관련 비즈니스 로직 담당
 * - Repository 인터페이스에 의존 (테스트 시 Mock 가능)
 */
@Injectable()
export class PointService {
  private readonly MAX_POINT = 10000000; // 최대 포인트: 1천만
  private readonly MAX_CHARGE_PER_TRANSACTION = 1000000; // 1건당 최대 충전: 100만원
  private readonly USE_UNIT = 100; // 사용 단위: 100원

  constructor(
    @Inject('IPointRepository')
    private readonly pointRepository: IPointRepository,
  ) {}

  /**
   * 특정 유저의 포인트 조회
   */
  async getPoint(userId: number): Promise<UserPoint> {
    this.validateUserId(userId);
    return await this.pointRepository.getUserPoint(userId);
  }

  /**
   * 특정 유저의 포인트 충전
   */
  async chargePoint(userId: number, amount: number): Promise<UserPoint> {
    this.validateUserId(userId);
    this.validateAmount(amount);
    this.validateChargeAmount(amount);

    // 현재 포인트 조회
    const currentPoint = await this.pointRepository.getUserPoint(userId);

    // 충전 후 포인트 계산 및 검증
    const newPoint = currentPoint.point + amount;
    this.validateMaxPoint(newPoint);

    // 포인트 업데이트
    const updatedPoint = await this.pointRepository.updateUserPoint(
      userId,
      newPoint,
    );

    // 이력 기록
    await this.pointRepository.addPointHistory(
      userId,
      amount,
      TransactionType.CHARGE,
      updatedPoint.updateMillis,
    );

    return updatedPoint;
  }

  /**
   * 특정 유저의 포인트 사용
   */
  async usePoint(userId: number, amount: number): Promise<UserPoint> {
    this.validateUserId(userId);
    this.validateAmount(amount);
    this.validateUseAmount(amount);

    // 현재 포인트 조회
    const currentPoint = await this.pointRepository.getUserPoint(userId);

    // 잔액 확인
    if (currentPoint.point < amount) {
      throw new BadRequestException('포인트가 부족합니다');
    }

    // 사용 후 포인트 계산
    const newPoint = currentPoint.point - amount;

    // 포인트 업데이트
    const updatedPoint = await this.pointRepository.updateUserPoint(
      userId,
      newPoint,
    );

    // 이력 기록
    await this.pointRepository.addPointHistory(
      userId,
      amount,
      TransactionType.USE,
      updatedPoint.updateMillis,
    );

    return updatedPoint;
  }

  /**
   * 특정 유저의 포인트 이용 내역 조회
   */
  async getPointHistories(userId: number): Promise<PointHistory[]> {
    this.validateUserId(userId);
    return await this.pointRepository.getPointHistories(userId);
  }

  /**
   * 유저 ID 유효성 검증
   */
  private validateUserId(userId: number): void {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('올바르지 않은 ID 값 입니다.');
    }
  }

  /**
   * 금액 유효성 검증
   */
  private validateAmount(amount: number): void {
    if (!Number.isInteger(amount)) {
      throw new BadRequestException('포인트는 정수만 가능합니다');
    }

    if (amount <= 0) {
      throw new BadRequestException('포인트는 0보다 커야 합니다');
    }

    if (amount > this.MAX_POINT) {
      throw new BadRequestException(
        `포인트는 ${this.MAX_POINT}을 초과할 수 없습니다`,
      );
    }
  }

  /**
   * 최대 포인트 초과 검증
   */
  private validateMaxPoint(point: number): void {
    if (point > this.MAX_POINT) {
      throw new BadRequestException('포인트가 최대값을 초과합니다');
    }
  }

  /**
   * 충전 금액 유효성 검증
   * - 1건당 최대 100만원까지만 충전 가능
   */
  private validateChargeAmount(amount: number): void {
    if (amount > this.MAX_CHARGE_PER_TRANSACTION) {
      throw new BadRequestException(
        `1건당 최대 충전 금액은 ${this.MAX_CHARGE_PER_TRANSACTION}원 입니다`,
      );
    }
  }

  /**
   * 사용 금액 유효성 검증
   * - 100원 단위로만 사용 가능
   */
  private validateUseAmount(amount: number): void {
    if (amount % this.USE_UNIT !== 0) {
      throw new BadRequestException(
        `포인트는 ${this.USE_UNIT}원 단위로만 사용 가능합니다`,
      );
    }
  }
}
