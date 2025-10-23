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
    describe('동시 충전 요청', () => {
      it('동일 사용자에 대한 2개의 충전 요청이 동시에 들어오면 모두 정확히 반영되어야 한다', async () => {
        // Given
        const userId = 100;
        const chargeAmount = 10000;

        // When: 동시에 2번 충전
        await Promise.all([
          service.chargePoint(userId, chargeAmount),
          service.chargePoint(userId, chargeAmount),
        ]);

        // Then: 동시성 제어가 제대로 되어 있다면 정확히 20000이 되어야 함
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(20000);

        // 이력은 2개가 기록됨
        const histories = await service.getPointHistories(userId);
        expect(histories).toHaveLength(2);
        expect(histories.every((h) => h.type === TransactionType.CHARGE)).toBe(
          true,
        );
      });

      it('동일 사용자에 대한 5개의 충전 요청이 동시에 들어오면 모두 정확히 반영되어야 한다', async () => {
        // Given
        const userId = 101;
        const chargeAmount = 5000;
        const concurrentRequests = 5;

        // When: 동시에 5번 충전
        const promises = Array(concurrentRequests)
          .fill(null)
          .map(() => service.chargePoint(userId, chargeAmount));

        await Promise.all(promises);

        // Then: 동시성 제어가 제대로 되어 있다면 정확히 25000이 되어야 함
        const userPoint = await service.getPoint(userId);
        const expectedAmount = chargeAmount * concurrentRequests; // 25000
        expect(userPoint.point).toBe(expectedAmount);

        // 이력은 5개 모두 기록됨
        const histories = await service.getPointHistories(userId);
        expect(histories).toHaveLength(concurrentRequests);
      });

      it('동시 충전 시 이력이 모두 정확히 기록되어야 한다', async () => {
        // Given
        const userId = 105;

        // When: 서로 다른 금액으로 동시 충전
        await Promise.all([
          service.chargePoint(userId, 10000),
          service.chargePoint(userId, 20000),
        ]);

        // Then: 포인트는 정확히 30000
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(30000);

        // 이력은 2개 모두 기록되고, 모두 CHARGE 타입
        const histories = await service.getPointHistories(userId);
        expect(histories).toHaveLength(2);
        expect(
          histories.every((h) => h.type === TransactionType.CHARGE),
        ).toBe(true);

        // 충전 금액들이 모두 포함되어 있어야 함
        const amounts = histories.map((h) => h.amount).sort((a, b) => a - b);
        expect(amounts).toEqual([10000, 20000]);
      });
    });

    describe('동시 사용 요청', () => {
      it('충분한 잔액이 있을 때 동시 사용 요청이 들어오면 모두 정확히 차감되어야 한다', async () => {
        // Given
        const userId = 102;
        const initialBalance = 50000;
        const useAmount = 10000;

        // 초기 잔액 충전
        await service.chargePoint(userId, initialBalance);

        // When: 동시에 2번 사용 (총 20000 사용 시도)
        await Promise.all([
          service.usePoint(userId, useAmount),
          service.usePoint(userId, useAmount),
        ]);

        // Then: 동시성 제어가 제대로 되어 있다면 정확히 30000이 되어야 함
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(30000);

        const histories = await service.getPointHistories(userId);
        const useHistories = histories.filter(
          (h) => h.type === TransactionType.USE,
        );
        expect(useHistories).toHaveLength(2);
      });

      it('잔액이 부족한 상황에서 동시 사용 요청 시 하나만 성공하고 나머지는 실패해야 한다', async () => {
        // Given
        const userId = 103;
        const initialBalance = 15000;
        const useAmount = 10000;

        await service.chargePoint(userId, initialBalance);

        // When: 동시에 2번 사용 (총 20000 사용 시도하지만 잔액은 15000)
        const results = await Promise.allSettled([
          service.usePoint(userId, useAmount),
          service.usePoint(userId, useAmount),
        ]);

        // Then: 정확히 하나만 성공하고 하나는 실패해야 함
        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        expect(fulfilled.length).toBe(1);
        expect(rejected.length).toBe(1);
        expect(rejected[0].reason).toBeInstanceOf(BadRequestException);

        // 최종 잔액은 5000이어야 함 (15000 - 10000)
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(5000);
      });

      it('동시 사용 실패 시 실패한 요청은 이력에 기록되지 않아야 한다', async () => {
        // Given
        const userId = 106;
        await service.chargePoint(userId, 10000);

        // When: 동시에 사용 (하나는 성공, 하나는 실패 예상)
        const results = await Promise.allSettled([
          service.usePoint(userId, 8000),
          service.usePoint(userId, 8000), // 잔액 부족으로 실패해야 함
        ]);

        // Then: 하나는 성공, 하나는 실패
        const rejected = results.filter((r) => r.status === 'rejected');
        expect(rejected.length).toBe(1);

        // 이력은 성공한 요청만 기록 (초기 충전 1개 + 성공한 사용 1개)
        const histories = await service.getPointHistories(userId);
        expect(histories).toHaveLength(2);

        const useHistories = histories.filter(
          (h) => h.type === TransactionType.USE,
        );
        expect(useHistories).toHaveLength(1);
        expect(useHistories[0].amount).toBe(8000);

        // 최종 잔액 확인
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(2000); // 10000 - 8000
      });
    });

    describe('혼합 동시 요청 (충전 + 사용)', () => {
      it('충전과 사용이 동시에 발생해도 정확한 순서로 처리되어야 한다', async () => {
        // Given
        const userId = 104;
        const initialBalance = 10000;
        const chargeAmount = 20000;
        const useAmount = 15000;

        await service.chargePoint(userId, initialBalance);

        // When: 충전과 사용이 동시에 발생
        await Promise.all([
          service.chargePoint(userId, chargeAmount),
          service.usePoint(userId, useAmount),
        ]);

        // Then: 동시성 제어가 제대로 되어 있다면 정확히 15000이 되어야 함
        // (10000 + 20000 - 15000 = 15000)
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(15000);

        const histories = await service.getPointHistories(userId);
        expect(histories).toHaveLength(3); // 초기충전, 충전, 사용
      });

      it('여러 사용자의 요청이 동시에 처리되면 독립적으로 작동해야 한다', async () => {
        // Given
        const user1 = 201;
        const user2 = 202;
        const user3 = 203;
        const chargeAmount = 10000;

        // When: 서로 다른 사용자의 충전이 동시에 발생
        await Promise.all([
          service.chargePoint(user1, chargeAmount),
          service.chargePoint(user2, chargeAmount),
          service.chargePoint(user3, chargeAmount),
        ]);

        // Then: 각 사용자는 독립적으로 처리되어야 함
        const point1 = await service.getPoint(user1);
        const point2 = await service.getPoint(user2);
        const point3 = await service.getPoint(user3);

        expect(point1.point).toBe(chargeAmount);
        expect(point2.point).toBe(chargeAmount);
        expect(point3.point).toBe(chargeAmount);

        // 각 사용자는 독립적이므로 동시성 문제가 없어야 함
      });
    });

    describe('순차 vs 동시 실행 비교', () => {
      it('순차 실행 시에는 정확한 결과가 나온다 (베이스라인)', async () => {
        // Given
        const userId = 301;
        const chargeAmount = 10000;

        // When: 순차 실행
        await service.chargePoint(userId, chargeAmount);
        await service.chargePoint(userId, chargeAmount);
        await service.chargePoint(userId, chargeAmount);

        // Then: 정확히 30000이 되어야 함
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(30000);

        const histories = await service.getPointHistories(userId);
        expect(histories).toHaveLength(3);
      });

      it('동시 실행 시에도 순차 실행과 동일한 결과가 나와야 한다', async () => {
        // Given
        const userId = 302;
        const chargeAmount = 10000;

        // When: 동시 실행
        await Promise.all([
          service.chargePoint(userId, chargeAmount),
          service.chargePoint(userId, chargeAmount),
          service.chargePoint(userId, chargeAmount),
        ]);

        // Then: 동시성 제어가 제대로 되어 있다면 순차 실행과 동일하게 30000이 되어야 함
        const userPoint = await service.getPoint(userId);
        expect(userPoint.point).toBe(30000);

        // 이력은 3개 모두 기록됨
        const histories = await service.getPointHistories(userId);
        expect(histories).toHaveLength(3);
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
