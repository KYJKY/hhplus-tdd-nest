import { Injectable } from '@nestjs/common';
import { UserPointTable } from 'src/database/userpoint.table';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { UserPoint, PointHistory, TransactionType } from './point.model';
import { IPointRepository } from './point.repository.interface';

/**
 * Point Repository 구현체
 * - Database Table 클래스를 래핑
 * - IPointRepository 인터페이스 구현
 * - 테스트 시 Mock으로 대체 가능
 */
@Injectable()
export class PointRepository implements IPointRepository {
  constructor(
    private readonly userPointTable: UserPointTable,
    private readonly pointHistoryTable: PointHistoryTable,
  ) {}

  async getUserPoint(userId: number): Promise<UserPoint> {
    return await this.userPointTable.selectById(userId);
  }

  async updateUserPoint(userId: number, point: number): Promise<UserPoint> {
    return await this.userPointTable.insertOrUpdate(userId, point);
  }

  async addPointHistory(
    userId: number,
    amount: number,
    type: TransactionType,
    timeMillis: number,
  ): Promise<PointHistory> {
    return await this.pointHistoryTable.insert(
      userId,
      amount,
      type,
      timeMillis,
    );
  }

  async getPointHistories(userId: number): Promise<PointHistory[]> {
    return await this.pointHistoryTable.selectAllByUserId(userId);
  }
}
