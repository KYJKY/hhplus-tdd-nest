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
    return this.pointRepository.getUserPoint(userId);
  }

  /**
   * 특정 유저의 포인트 충전
   * @param userId - 사용자 ID (Controller의 ParseIntPipe로 이미 검증됨)
   * @param amount - 충전 금액 (DTO의 @IsInt, @Min으로 이미 검증됨)
   */
  async chargePoint(userId: number, amount: number): Promise<UserPoint> {
    return this.executePointTransaction(
      userId,
      amount,
      TransactionType.CHARGE,
      () => {
        PointValidator.validateChargeAmount(amount);
      },
      (currentPoint) => {
        const newPoint = currentPoint + amount;
        PointValidator.validateMaxPoint(newPoint);
        return newPoint;
      },
    );
  }

  /**
   * 특정 유저의 포인트 사용
   * @param userId - 사용자 ID (Controller의 ParseIntPipe로 이미 검증됨)
   * @param amount - 사용 금액 (DTO의 @IsInt, @Min으로 이미 검증됨)
   */
  async usePoint(userId: number, amount: number): Promise<UserPoint> {
    return this.executePointTransaction(
      userId,
      amount,
      TransactionType.USE,
      () => {
        PointValidator.validateUseAmount(amount);
      },
      (currentPoint) => {
        PointValidator.validateSufficientBalance(currentPoint, amount);
        return currentPoint - amount;
      },
    );
  }

  /**
   * 특정 유저의 포인트 이용 내역 조회
   * @param userId - 사용자 ID (Controller의 ParseIntPipe로 이미 검증됨)
   */
  async getPointHistories(userId: number): Promise<PointHistory[]> {
    return this.pointRepository.getPointHistories(userId);
  }

  /**
   * 포인트 트랜잭션을 실행합니다 (템플릿 메서드 패턴)
   * - Lock 획득, 검증, 포인트 계산, 업데이트, 이력 기록을 순차 처리
   * - chargePoint와 usePoint의 공통 로직을 추상화
   *
   * @param userId - 사용자 ID
   * @param amount - 거래 금액
   * @param transactionType - 거래 유형 (CHARGE 또는 USE)
   * @param validateAmount - 금액 검증 로직
   * @param calculateNewPoint - 새로운 포인트 계산 로직
   */
  private async executePointTransaction(
    userId: number,
    amount: number,
    transactionType: TransactionType,
    validateAmount: () => void,
    calculateNewPoint: (currentPoint: number) => number,
  ): Promise<UserPoint> {
    return this.lockManager.acquire(userId, async () => {
      // 1. 금액 검증
      validateAmount();

      // 2. 현재 포인트 조회
      const userPoint = await this.pointRepository.getUserPoint(userId);

      // 3. 새로운 포인트 계산 (검증 포함)
      const newPoint = calculateNewPoint(userPoint.point);

      // 4. 포인트 업데이트 및 이력 기록
      return this.updatePointWithHistory(
        userId,
        newPoint,
        amount,
        transactionType,
      );
    });
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
