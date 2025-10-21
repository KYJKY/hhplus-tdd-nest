import { UserPoint, PointHistory, TransactionType } from './point.model';

/**
 * 포인트 데이터 액세스를 위한 Repository 인터페이스
 * - 테스트 시 Mock 객체로 대체 가능
 * - Database Table 클래스에 대한 추상화 제공
 */
export interface IPointRepository {
  /**
   * 특정 유저의 포인트 조회
   */
  getUserPoint(userId: number): Promise<UserPoint>;

  /**
   * 유저 포인트 업데이트 (생성 또는 갱신)
   */
  updateUserPoint(userId: number, point: number): Promise<UserPoint>;

  /**
   * 포인트 이력 추가
   */
  addPointHistory(
    userId: number,
    amount: number,
    type: TransactionType,
    timeMillis: number,
  ): Promise<PointHistory>;

  /**
   * 특정 유저의 포인트 이력 조회
   */
  getPointHistories(userId: number): Promise<PointHistory[]>;
}
