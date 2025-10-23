import { BadRequestException } from '@nestjs/common';
import { PointConstants, PointErrorMessages } from './point.constants';

/**
 * 포인트 비즈니스 규칙 검증
 * - Service에서 분리하여 Single Responsibility Principle 준수
 * - 테스트 용이성 향상
 */
export class PointValidator {
  /**
   * 최대 포인트 초과 검증
   * @param point - 검증할 포인트 값
   * @throws BadRequestException 최대 포인트 초과 시
   */
  static validateMaxPoint(point: number): void {
    if (point > PointConstants.MAX_POINT) {
      throw new BadRequestException(PointErrorMessages.MAX_POINT_EXCEEDED);
    }
  }

  /**
   * 충전 금액 유효성 검증
   * @param amount - 충전 금액
   * @throws BadRequestException 최대 충전 금액 초과 시
   */
  static validateChargeAmount(amount: number): void {
    if (amount > PointConstants.MAX_CHARGE_PER_TRANSACTION) {
      throw new BadRequestException(
        PointErrorMessages.MAX_CHARGE_EXCEEDED(
          PointConstants.MAX_CHARGE_PER_TRANSACTION,
        ),
      );
    }
  }

  /**
   * 사용 금액 유효성 검증
   * @param amount - 사용 금액
   * @throws BadRequestException 사용 단위가 맞지 않을 시
   */
  static validateUseAmount(amount: number): void {
    if (amount % PointConstants.USE_UNIT !== 0) {
      throw new BadRequestException(
        PointErrorMessages.INVALID_USE_UNIT(PointConstants.USE_UNIT),
      );
    }
  }

  /**
   * 잔액 충분 여부 검증
   * @param currentPoint - 현재 포인트
   * @param amountToUse - 사용하려는 금액
   * @throws BadRequestException 잔액 부족 시
   */
  static validateSufficientBalance(
    currentPoint: number,
    amountToUse: number,
  ): void {
    if (currentPoint < amountToUse) {
      throw new BadRequestException(PointErrorMessages.INSUFFICIENT_BALANCE);
    }
  }
}
