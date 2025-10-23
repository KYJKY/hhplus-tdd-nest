import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from '../point.service';
import { PointRepository } from '../point.repository';
import { UserPointTable } from '../../database/userpoint.table';
import { PointHistoryTable } from '../../database/pointhistory.table';
import { TransactionType } from '../point.model';
import { BadRequestException } from '@nestjs/common';

/**
 * Point Integration Tests
 * - Controller + Service + Repository + Database Tables 통합 테스트
 * - 실제 Database Table 인스턴스 사용 (in-memory)
 * - 동시성 문제 검증
 */
describe('Point Integration Tests', () => {
  let service: PointService;
  let userPointTable: UserPointTable;
  let pointHistoryTable: PointHistoryTable;

  beforeEach(async () => {
    // 실제 인스턴스로 통합 테스트 환경 구성
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointService,
        PointRepository,
        UserPointTable,
        PointHistoryTable,
        {
          provide: 'IPointRepository',
          useClass: PointRepository,
        },
      ],
    }).compile();

    service = module.get<PointService>(PointService);
    userPointTable = module.get<UserPointTable>(UserPointTable);
    pointHistoryTable = module.get<PointHistoryTable>(PointHistoryTable);
  });

  describe('Feature Integration Tests - 기능별 통합', () => {
    describe('충전 → 조회 → 이력 확인 시나리오', () => {
      it('포인트 충전 후 조회하면 충전된 금액이 반영되어야 한다', async () => {
        // Given
        const userId = 1;
        const chargeAmount = 10000;

        // When
        await service.chargePoint(userId, chargeAmount);
        const userPoint = await service.getPoint(userId);

        // Then
        expect(userPoint.point).toBe(chargeAmount);
      });

      it('포인트 충전 후 이력을 조회하면 CHARGE 타입으로 기록되어야 한다', async () => {
        // Given
        const userId = 2;
        const chargeAmount = 5000;

        // When
        await service.chargePoint(userId, chargeAmount);
        const histories = await service.getPointHistories(userId);

        // Then
        expect(histories).toHaveLength(1);
        expect(histories[0].userId).toBe(userId);
        expect(histories[0].amount).toBe(chargeAmount);
        expect(histories[0].type).toBe(TransactionType.CHARGE);
      });

      it('연속으로 2번 충전하면 총 금액이 누적되어야 한다', async () => {
        // Given
        const userId = 3;
        const firstCharge = 10000;
        const secondCharge = 20000;

        // When
        await service.chargePoint(userId, firstCharge);
        await service.chargePoint(userId, secondCharge);
        const userPoint = await service.getPoint(userId);

        // Then
        expect(userPoint.point).toBe(firstCharge + secondCharge);
      });
    });

    describe('사용 → 조회 → 이력 확인 시나리오', () => {
      it('포인트 충전 후 사용하면 차감된 금액이 반영되어야 한다', async () => {
        // Given
        const userId = 4;
        const chargeAmount = 10000;
        const useAmount = 3000;

        // When
        await service.chargePoint(userId, chargeAmount);
        await service.usePoint(userId, useAmount);
        const userPoint = await service.getPoint(userId);

        // Then
        expect(userPoint.point).toBe(chargeAmount - useAmount);
      });

      it('포인트 사용 후 이력을 조회하면 USE 타입으로 기록되어야 한다', async () => {
        // Given
        const userId = 5;
        const chargeAmount = 10000;
        const useAmount = 2000;

        // When
        await service.chargePoint(userId, chargeAmount);
        await service.usePoint(userId, useAmount);
        const histories = await service.getPointHistories(userId);

        // Then
        expect(histories).toHaveLength(2);
        expect(histories[1].type).toBe(TransactionType.USE);
        expect(histories[1].amount).toBe(useAmount);
      });

      it('잔액이 부족하면 사용할 수 없다', async () => {
        // Given
        const userId = 6;
        const chargeAmount = 5000;
        const useAmount = 10000;

        // When
        await service.chargePoint(userId, chargeAmount);

        // Then
        await expect(service.usePoint(userId, useAmount)).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.usePoint(userId, useAmount)).rejects.toThrow(
          '포인트가 부족합니다',
        );
      });
    });

    describe('복합 시나리오', () => {
      it('충전 → 사용 → 충전 → 사용 순서대로 처리되어야 한다', async () => {
        // Given
        const userId = 7;

        // When & Then
        await service.chargePoint(userId, 100000);
        let point = await service.getPoint(userId);
        expect(point.point).toBe(100000);

        await service.usePoint(userId, 30000);
        point = await service.getPoint(userId);
        expect(point.point).toBe(70000);

        await service.chargePoint(userId, 50000);
        point = await service.getPoint(userId);
        expect(point.point).toBe(120000);

        await service.usePoint(userId, 20000);
        point = await service.getPoint(userId);
        expect(point.point).toBe(100000);

        // 이력 확인
        const histories = await service.getPointHistories(userId);
        expect(histories).toHaveLength(4);
        expect(histories[0].type).toBe(TransactionType.CHARGE);
        expect(histories[1].type).toBe(TransactionType.USE);
        expect(histories[2].type).toBe(TransactionType.CHARGE);
        expect(histories[3].type).toBe(TransactionType.USE);
      });
    });
  });

  describe('Concurrency Tests - 동시성 문제', () => {
    // userId 자동 증가로 테스트 독립성 보장
    let nextUserId = 1000;
    const getUserId = () => ++nextUserId;

    describe('동시 충전 요청', () => {
      it('동시 충전 시 모든 금액이 합산되어야 한다', async () => {
        // Given
        const userId = getUserId();
        const chargeAmount = 10000;

        // When: 동시에 2번 충전
        await Promise.all([
          service.chargePoint(userId, chargeAmount),
          service.chargePoint(userId, chargeAmount),
        ]);

        // Then
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(20000);
      });

      it('동시 충전 시 모든 이력이 기록되어야 한다', async () => {
        // Given
        const userId = getUserId();
        const chargeAmount = 10000;

        // When
        await Promise.all([
          service.chargePoint(userId, chargeAmount),
          service.chargePoint(userId, chargeAmount),
        ]);

        // Then
        const histories = await service.getPointHistories(userId);
        expect(histories).toHaveLength(2);
        expect(histories.every((h) => h.type === TransactionType.CHARGE)).toBe(
          true,
        );
      });

      it('5개의 동시 충전도 정확히 합산되어야 한다', async () => {
        // Given
        const userId = getUserId();
        const chargeAmount = 5000;
        const concurrentRequests = 5;

        // When
        const promises = Array(concurrentRequests)
          .fill(null)
          .map(() => service.chargePoint(userId, chargeAmount));
        await Promise.all(promises);

        // Then
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(25000);
      });

      it('다수의 동시 충전(10개)도 정확히 처리되어야 한다', async () => {
        // Given
        const userId = getUserId();
        const chargeAmount = 1000;
        const concurrentRequests = 10;

        // When
        const promises = Array(concurrentRequests)
          .fill(null)
          .map(() => service.chargePoint(userId, chargeAmount));
        await Promise.all(promises);

        // Then
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(10000);
      });

      it('서로 다른 금액의 동시 충전 시 각 이력이 정확히 기록되어야 한다', async () => {
        // Given
        const userId = getUserId();

        // When
        await Promise.all([
          service.chargePoint(userId, 10000),
          service.chargePoint(userId, 20000),
        ]);

        // Then
        const histories = await service.getPointHistories(userId);
        expect(histories).toHaveLength(2);

        const amounts = histories.map((h) => h.amount).sort((a, b) => a - b);
        expect(amounts).toEqual([10000, 20000]);
      });
    });

    describe('동시 사용 요청', () => {
      it('동시 사용 시 모든 금액이 차감되어야 한다', async () => {
        // Given
        const userId = getUserId();
        const initialBalance = 50000;
        const useAmount = 10000;

        await service.chargePoint(userId, initialBalance);

        // When
        await Promise.all([
          service.usePoint(userId, useAmount),
          service.usePoint(userId, useAmount),
        ]);

        // Then
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(30000);
      });

      it('동시 사용 시 모든 이력이 기록되어야 한다', async () => {
        // Given
        const userId = getUserId();
        await service.chargePoint(userId, 50000);

        // When
        await Promise.all([
          service.usePoint(userId, 10000),
          service.usePoint(userId, 10000),
        ]);

        // Then
        const histories = await service.getPointHistories(userId);
        const useHistories = histories.filter(
          (h) => h.type === TransactionType.USE,
        );
        expect(useHistories).toHaveLength(2);
      });

      it('잔액 부족 시 동시 사용은 하나만 성공해야 한다', async () => {
        // Given
        const userId = getUserId();
        await service.chargePoint(userId, 15000);

        // When
        const results = await Promise.allSettled([
          service.usePoint(userId, 10000),
          service.usePoint(userId, 10000),
        ]);

        // Then
        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        expect(fulfilled.length).toBe(1);
        expect(rejected.length).toBe(1);
        expect(rejected[0].reason).toBeInstanceOf(BadRequestException);
      });

      it('잔액 부족으로 실패한 요청은 이력에 기록되지 않아야 한다', async () => {
        // Given
        const userId = getUserId();
        await service.chargePoint(userId, 10000);

        // When
        const results = await Promise.allSettled([
          service.usePoint(userId, 8000),
          service.usePoint(userId, 8000),
        ]);

        // Then
        const rejected = results.filter((r) => r.status === 'rejected');
        expect(rejected.length).toBe(1);

        const histories = await service.getPointHistories(userId);
        const useHistories = histories.filter(
          (h) => h.type === TransactionType.USE,
        );
        expect(useHistories).toHaveLength(1);
        expect(useHistories[0].amount).toBe(8000);
      });

      it('잔액 부족으로 실패 시 최종 잔액이 정확해야 한다', async () => {
        // Given
        const userId = getUserId();
        await service.chargePoint(userId, 15000);

        // When
        await Promise.allSettled([
          service.usePoint(userId, 10000),
          service.usePoint(userId, 10000),
        ]);

        // Then
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(5000);
      });
    });

    describe('혼합 동시 요청 (충전 + 사용)', () => {
      it('충전과 사용이 동시에 발생해도 최종 잔액이 정확해야 한다', async () => {
        // Given
        const userId = getUserId();
        await service.chargePoint(userId, 10000);

        // When: 충전(+20000)과 사용(-15000)이 동시에 발생
        await Promise.all([
          service.chargePoint(userId, 20000),
          service.usePoint(userId, 15000),
        ]);

        // Then: 순서 무관하게 최종 잔액은 15000
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(15000);
      });

      it('충전과 사용이 동시에 발생해도 모든 이력이 기록되어야 한다', async () => {
        // Given
        const userId = getUserId();
        await service.chargePoint(userId, 10000);

        // When
        await Promise.all([
          service.chargePoint(userId, 20000),
          service.usePoint(userId, 15000),
        ]);

        // Then
        const histories = await service.getPointHistories(userId);
        expect(histories).toHaveLength(3); // 초기충전, 충전, 사용
      });

      it('여러 사용자의 요청은 독립적으로 처리되어야 한다', async () => {
        // Given
        const user1 = getUserId();
        const user2 = getUserId();
        const user3 = getUserId();

        // When: 서로 다른 사용자의 충전이 동시에 발생
        await Promise.all([
          service.chargePoint(user1, 10000),
          service.chargePoint(user2, 20000),
          service.chargePoint(user3, 30000),
        ]);

        // Then: 각 사용자의 포인트가 독립적으로 관리됨
        const point1 = await service.getPoint(user1);
        const point2 = await service.getPoint(user2);
        const point3 = await service.getPoint(user3);

        expect(point1.point).toBe(10000);
        expect(point2.point).toBe(20000);
        expect(point3.point).toBe(30000);
      });
    });

    describe('순차 vs 동시 실행 비교', () => {
      it('순차 실행 시 정확한 결과가 나온다', async () => {
        // Given
        const userId = getUserId();
        const chargeAmount = 10000;

        // When: 순차 실행
        await service.chargePoint(userId, chargeAmount);
        await service.chargePoint(userId, chargeAmount);
        await service.chargePoint(userId, chargeAmount);

        // Then
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(30000);
      });

      it('동시 실행도 순차 실행과 동일한 결과가 나와야 한다', async () => {
        // Given
        const userId = getUserId();
        const chargeAmount = 10000;

        // When: 동시 실행
        await Promise.all([
          service.chargePoint(userId, chargeAmount),
          service.chargePoint(userId, chargeAmount),
          service.chargePoint(userId, chargeAmount),
        ]);

        // Then
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(30000);
      });
    });
  });

  describe('Database Layer Integration - 실제 테이블 작동 확인', () => {
    it('UserPointTable의 insertOrUpdate는 이전 값을 덮어쓴다', async () => {
      // Given
      const userId = 400;

      // When: 같은 ID로 여러 번 업데이트
      await userPointTable.insertOrUpdate(userId, 1000);
      await userPointTable.insertOrUpdate(userId, 2000);
      const result = await userPointTable.selectById(userId);

      // Then: 마지막 값만 남음
      expect(result.point).toBe(2000);
    });

    it('PointHistoryTable의 insert는 모든 이력을 누적한다', async () => {
      // Given
      const userId = 401;

      // When: 여러 이력 추가
      await pointHistoryTable.insert(userId, 1000, TransactionType.CHARGE, Date.now());
      await pointHistoryTable.insert(userId, 2000, TransactionType.CHARGE, Date.now());
      await pointHistoryTable.insert(userId, 500, TransactionType.USE, Date.now());

      const histories = await pointHistoryTable.selectAllByUserId(userId);

      // Then: 모든 이력이 보관됨
      expect(histories).toHaveLength(3);
    });
  });
});
