import { IsInt, Min } from 'class-validator';

/**
 * 포인트 충전 DTO
 * - 입력 형식 검증 (정수, 양수)
 * - 비즈니스 규칙은 Service에서 검증
 */
export class ChargePointDto {
  @IsInt({ message: '포인트는 정수만 가능합니다' })
  @Min(1, { message: '포인트는 0보다 커야 합니다' })
  amount: number;
}

/**
 * 포인트 사용 DTO
 * - 입력 형식 검증 (정수, 양수)
 * - 비즈니스 규칙은 Service에서 검증
 */
export class UsePointDto {
  @IsInt({ message: '포인트는 정수만 가능합니다' })
  @Min(1, { message: '포인트는 0보다 커야 합니다' })
  amount: number;
}

/**
 * @deprecated ChargePointDto 또는 UsePointDto 사용 권장
 */
export class PointBody {
  @IsInt()
  amount: number;
}
