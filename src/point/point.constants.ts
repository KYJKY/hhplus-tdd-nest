/**
 * 포인트 시스템 상수
 */
export const PointConstants = {
  /** 최대 보유 가능 포인트 */
  MAX_POINT: 10_000_000,
  /** 1건당 최대 충전 금액 */
  MAX_CHARGE_PER_TRANSACTION: 1_000_000,
  /** 포인트 사용 단위 */
  USE_UNIT: 100,
} as const;

/**
 * 포인트 시스템 에러 메시지
 */
export const PointErrorMessages = {
  MAX_POINT_EXCEEDED: '포인트가 최대값을 초과합니다',
  MAX_CHARGE_EXCEEDED: (max: number) =>
    `1건당 최대 충전 금액은 ${max}원 입니다`,
  INVALID_USE_UNIT: (unit: number) =>
    `포인트는 ${unit}원 단위로만 사용 가능합니다`,
  INSUFFICIENT_BALANCE: '포인트가 부족합니다',
} as const;
