import { Injectable, Inject } from '@nestjs/common';
import { UserPoint, PointHistory, TransactionType } from './point.model';
import { IPointRepository } from './point.repository.interface';
import { PointValidator } from './point.validator';
import { LockManager } from './lock-manager';

/**
 * Point Service
 * - 포인트 관련 비즈니스 로직 담당
 * - Repository 인터페이스에 의존 (테스트 시 Mock 가능)
 * - 검증 로직은 PointValidator로 위임
 * - LockManager로 동시성 제어
 */
@Injectable()
export class PointService {
  constructor(
    @Inject('IPointRepository')
    private readonly pointRepository: IPointRepository,
    private readonly lockManager: LockManager,
  ) {}

  /**
   * 특정 유저의 포인트 조회
   * @param userId - 사용자 ID (Controller의 ParseIntPipe로 이미 검증됨)
   */
  async getPoint(userId: number): Promise<UserPoint> {
    return await this.pointRepository.getUserPoint(userId);
  }

  /**
   * 특정 유저의 포인트 충전
   * @param userId - 사용자 ID (Controller의 ParseIntPipe로 이미 검증됨)
   * @param amount - 충전 금액 (DTO의 @IsInt, @Min으로 이미 검증됨)
   */
  async chargePoint(userId: number, amount: number): Promise<UserPoint> {
    // Lock을 획득하고 작업을 순차적으로 처리
    return this.lockManager.acquire(userId, async () => {
      // 비즈니스 규칙 검증
      PointValidator.validateChargeAmount(amount);

      // 현재 포인트 조회
      const currentPoint = await this.pointRepository.getUserPoint(userId);

      // 충전 후 포인트 계산 및 검증
      const newPoint = currentPoint.point + amount;
      PointValidator.validateMaxPoint(newPoint);

      // 포인트 업데이트 및 이력 기록
      return await this.updatePointWithHistory(
        userId,
        newPoint,
        amount,
        TransactionType.CHARGE,
      );
    });
  }

  /**
   * 특정 유저의 포인트 사용
   * @param userId - 사용자 ID (Controller의 ParseIntPipe로 이미 검증됨)
   * @param amount - 사용 금액 (DTO의 @IsInt, @Min으로 이미 검증됨)
   */
  async usePoint(userId: number, amount: number): Promise<UserPoint> {
    // Lock을 획득하고 작업을 순차적으로 처리
    return this.lockManager.acquire(userId, async () => {
      // 비즈니스 규칙 검증
      PointValidator.validateUseAmount(amount);

      // 현재 포인트 조회
      const currentPoint = await this.pointRepository.getUserPoint(userId);

      // 잔액 확인
      PointValidator.validateSufficientBalance(currentPoint.point, amount);

      // 사용 후 포인트 계산
      const newPoint = currentPoint.point - amount;

      // 포인트 업데이트 및 이력 기록
      return await this.updatePointWithHistory(
        userId,
        newPoint,
        amount,
        TransactionType.USE,
      );
    });
  }

  /**
   * 특정 유저의 포인트 이용 내역 조회
   * @param userId - 사용자 ID (Controller의 ParseIntPipe로 이미 검증됨)
   */
  async getPointHistories(userId: number): Promise<PointHistory[]> {
    return await this.pointRepository.getPointHistories(userId);
  }

  /**
   * 포인트 업데이트 및 이력 기록 (공통 로직 추출)
   * - DRY 원칙 적용: chargePoint와 usePoint의 중복 제거
   * @param userId - 사용자 ID
   * @param newPoint - 업데이트할 포인트 값
   * @param amount - 거래 금액
   * @param type - 거래 유형 (CHARGE 또는 USE)
   */
  private async updatePointWithHistory(
    userId: number,
    newPoint: number,
    amount: number,
    type: TransactionType,
  ): Promise<UserPoint> {
    // 포인트 업데이트
    const updatedPoint = await this.pointRepository.updateUserPoint(
      userId,
      newPoint,
    );

    // 이력 기록
    await this.pointRepository.addPointHistory(
      userId,
      amount,
      type,
      updatedPoint.updateMillis,
    );

    return updatedPoint;
  }
}
