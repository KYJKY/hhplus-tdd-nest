import { Test, TestingModule } from '@nestjs/testing';
import { PointController } from './point.controller';
import { UserPointTable } from 'src/database/userpoint.table';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { UserPoint, PointHistory, TransactionType } from './point.model';
import { PointBody } from './point.dto';

describe('PointController', () => {
  let controller: PointController;
  let userPointTable: UserPointTable;
  let pointHistoryTable: PointHistoryTable;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PointController],
      providers: [UserPointTable, PointHistoryTable],
    }).compile();

    controller = module.get<PointController>(PointController);
    userPointTable = module.get<UserPointTable>(UserPointTable);
    pointHistoryTable = module.get<PointHistoryTable>(PointHistoryTable);
  });

  describe('point - 특정 유저의 포인트 조회', () => {
    describe('Given - 유저가 존재하고 포인트가 있는 경우', () => {
      it('When - 유효한 유저 ID로 조회하면, Then - 해당 유저의 포인트 정보를 반환해야 한다', async () => {
        // Given
        const userId = 1;
        const expectedPoint = 5000;
        await userPointTable.insertOrUpdate(userId, expectedPoint);

        // When
        const result: UserPoint = await controller.point(userId.toString());

        // Then
        expect(result).toBeDefined();
        expect(result.id).toBe(userId);
        expect(result.point).toBe(expectedPoint);
        expect(result.updateMillis).toBeDefined();
      });
    });

    describe('Given - 유저가 존재하지 않는 경우', () => {
      it('When - 포인트 이력이 없는 유저 ID로 조회하면, Then - 0 포인트로 초기화된 정보를 반환해야 한다', async () => {
        // Given
        const userId = 999;

        // When
        const result: UserPoint = await controller.point(userId.toString());

        // Then
        expect(result).toBeDefined();
        expect(result.id).toBe(userId);
        expect(result.point).toBe(0);
        expect(result.updateMillis).toBeDefined();
      });
    });

    describe('Given - 잘못된 유저 ID가 제공된 경우', () => {
      it('When - 음수 ID로 조회하면, Then - 에러를 발생시켜야 한다', async () => {
        // Given
        const invalidUserId = -1;

        // When & Then
        await expect(
          controller.point(invalidUserId.toString()),
        ).rejects.toThrow('올바르지 않은 ID 값 입니다.');
      });

      it('When - 0으로 조회하면, Then - 에러를 발생시켜야 한다', async () => {
        // Given
        const invalidUserId = 0;

        // When & Then
        await expect(
          controller.point(invalidUserId.toString()),
        ).rejects.toThrow('올바르지 않은 ID 값 입니다.');
      });

      it('When - 정수가 아닌 값으로 조회하면, Then - 에러를 발생시켜야 한다', async () => {
        // Given
        const invalidUserId = 1.5;

        // When & Then
        await expect(
          controller.point(invalidUserId.toString()),
        ).rejects.toThrow('올바르지 않은 ID 값 입니다.');
      });
    });
  });

  describe('history - 특정 유저의 포인트 충전/이용 내역 조회', () => {
    describe('Given - 유저가 포인트 충전/이용 이력이 있는 경우', () => {
      it('When - 유저 ID로 조회하면, Then - 해당 유저의 모든 포인트 이력을 반환해야 한다', async () => {
        // Given
        const userId = 1;
        await pointHistoryTable.insert(
          userId,
          1000,
          TransactionType.CHARGE,
          Date.now(),
        );
        await pointHistoryTable.insert(
          userId,
          500,
          TransactionType.USE,
          Date.now(),
        );
        await pointHistoryTable.insert(
          userId,
          2000,
          TransactionType.CHARGE,
          Date.now(),
        );

        // When
        const result: PointHistory[] = await controller.history(
          userId.toString(),
        );

        // Then
        expect(result).toBeDefined();
        expect(result.length).toBe(3);
        expect(result[0].userId).toBe(userId);
        expect(result[0].amount).toBe(1000);
        expect(result[0].type).toBe(TransactionType.CHARGE);
        expect(result[1].amount).toBe(500);
        expect(result[1].type).toBe(TransactionType.USE);
        expect(result[2].amount).toBe(2000);
        expect(result[2].type).toBe(TransactionType.CHARGE);
      });

      it('When - 여러 유저가 있을 때 특정 유저 ID로 조회하면, Then - 해당 유저의 이력만 반환해야 한다', async () => {
        // Given
        const userId1 = 1;
        const userId2 = 2;
        await pointHistoryTable.insert(
          userId1,
          1000,
          TransactionType.CHARGE,
          Date.now(),
        );
        await pointHistoryTable.insert(
          userId2,
          500,
          TransactionType.USE,
          Date.now(),
        );
        await pointHistoryTable.insert(
          userId1,
          300,
          TransactionType.USE,
          Date.now(),
        );

        // When
        const result: PointHistory[] = await controller.history(
          userId1.toString(),
        );

        // Then
        expect(result.length).toBe(2);
        expect(result.every((history) => history.userId === userId1)).toBe(
          true,
        );
      });
    });

    describe('Given - 유저가 포인트 이력이 없는 경우', () => {
      it('When - 유저 ID로 조회하면, Then - 빈 배열을 반환해야 한다', async () => {
        // Given
        const userId = 999;

        // When
        const result: PointHistory[] = await controller.history(
          userId.toString(),
        );

        // Then
        expect(result).toBeDefined();
        expect(result).toEqual([]);
        expect(result.length).toBe(0);
      });
    });

    describe('Given - 이력이 시간순으로 정렬되어야 하는 경우', () => {
      it('When - 유저 이력을 조회하면, Then - 오래된 순서대로 정렬되어야 한다', async () => {
        // Given
        const userId = 1;
        const time1 = Date.now();
        const time2 = time1 + 1000;
        const time3 = time2 + 1000;

        await pointHistoryTable.insert(
          userId,
          1000,
          TransactionType.CHARGE,
          time1,
        );
        await pointHistoryTable.insert(userId, 500, TransactionType.USE, time2);
        await pointHistoryTable.insert(
          userId,
          2000,
          TransactionType.CHARGE,
          time3,
        );

        // When
        const result: PointHistory[] = await controller.history(
          userId.toString(),
        );

        // Then
        expect(result.length).toBe(3);
        expect(result[0].timeMillis).toBeLessThanOrEqual(result[1].timeMillis);
        expect(result[1].timeMillis).toBeLessThanOrEqual(result[2].timeMillis);
      });
    });
  });

  describe('charge - 특정 유저의 포인트 충전', () => {
    describe('Given - 유저가 존재하는 경우', () => {
      it('When - 유효한 금액을 충전하면, Then - 포인트가 증가하고 충전된 포인트 정보를 반환해야 한다', async () => {
        // Given
        const userId = 1;
        const initialPoint = 1000;
        const chargeAmount = 500;
        await userPointTable.insertOrUpdate(userId, initialPoint);
        const pointDto: PointBody = { amount: chargeAmount };

        // When
        const result: UserPoint = await controller.charge(
          userId.toString(),
          pointDto,
        );

        // Then
        expect(result).toBeDefined();
        expect(result.id).toBe(userId);
        expect(result.point).toBe(initialPoint + chargeAmount);
        expect(result.updateMillis).toBeDefined();
      });

      it('When - 포인트를 충전하면, Then - 포인트 충전 이력이 기록되어야 한다', async () => {
        // Given
        const userId = 1;
        const chargeAmount = 1000;
        const pointDto: PointBody = { amount: chargeAmount };

        // When
        await controller.charge(userId.toString(), pointDto);
        const histories: PointHistory[] =
          await pointHistoryTable.selectAllByUserId(userId);

        // Then
        const chargeHistory = histories.find(
          (h) => h.type === TransactionType.CHARGE && h.amount === chargeAmount,
        );
        expect(chargeHistory).toBeDefined();
        expect(chargeHistory.userId).toBe(userId);
        expect(chargeHistory.type).toBe(TransactionType.CHARGE);
        expect(chargeHistory.amount).toBe(chargeAmount);
      });

      it('When - 포인트가 없는 유저가 충전하면, Then - 0에서 충전 금액만큼 증가해야 한다', async () => {
        // Given
        const userId = 999;
        const chargeAmount = 5000;
        const pointDto: PointBody = { amount: chargeAmount };

        // When
        const result: UserPoint = await controller.charge(
          userId.toString(),
          pointDto,
        );

        // Then
        expect(result.id).toBe(userId);
        expect(result.point).toBe(chargeAmount);
      });
    });

    describe('Given - 잘못된 충전 금액이 제공된 경우', () => {
      it('When - 음수 금액을 충전하려고 하면, Then - 에러를 발생시켜야 한다', async () => {
        // Given
        const userId = 1;
        const invalidAmount = -500;
        const pointDto: PointBody = { amount: invalidAmount };

        // When & Then
        await expect(
          controller.charge(userId.toString(), pointDto),
        ).rejects.toThrow();
      });

      it('When - 0원을 충전하려고 하면, Then - 에러를 발생시켜야 한다', async () => {
        // Given
        const userId = 1;
        const invalidAmount = 0;
        const pointDto: PointBody = { amount: invalidAmount };

        // When & Then
        await expect(
          controller.charge(userId.toString(), pointDto),
        ).rejects.toThrow();
      });

      it('When - 정수가 아닌 금액을 충전하려고 하면, Then - 에러를 발생시켜야 한다', async () => {
        // Given
        const userId = 1;
        const invalidAmount = 100.5;
        const pointDto: PointBody = { amount: invalidAmount };

        // When & Then
        await expect(
          controller.charge(userId.toString(), pointDto),
        ).rejects.toThrow();
      });
    });

    describe('Given - 매우 큰 금액을 충전하는 경우', () => {
      it('When - 최대 허용 금액 이하로 충전하면, Then - 정상적으로 충전되어야 한다', async () => {
        // Given
        const userId = 1;
        const largeAmount = 1000000;
        const pointDto: PointBody = { amount: largeAmount };

        // When
        const result: UserPoint = await controller.charge(
          userId.toString(),
          pointDto,
        );

        // Then
        expect(result.point).toBe(largeAmount);
      });

      it('When - 최대 허용 금액을 초과하여 충전하려고 하면, Then - 에러를 발생시켜야 한다', async () => {
        // Given
        const userId = 1;
        const tooLargeAmount = 10000001; // 1천만 초과
        const pointDto: PointBody = { amount: tooLargeAmount };

        // When & Then
        await expect(
          controller.charge(userId.toString(), pointDto),
        ).rejects.toThrow();
      });
    });
  });

  describe('use - 특정 유저의 포인트 사용', () => {
    describe('Given - 유저가 충분한 포인트를 가지고 있는 경우', () => {
      it('When - 유효한 금액을 사용하면, Then - 포인트가 감소하고 사용 후 포인트 정보를 반환해야 한다', async () => {
        // Given
        const userId = 1;
        const initialPoint = 5000;
        const useAmount = 2000;
        await userPointTable.insertOrUpdate(userId, initialPoint);
        const pointDto: PointBody = { amount: useAmount };

        // When
        const result: UserPoint = await controller.use(
          userId.toString(),
          pointDto,
        );

        // Then
        expect(result).toBeDefined();
        expect(result.id).toBe(userId);
        expect(result.point).toBe(initialPoint - useAmount);
        expect(result.updateMillis).toBeDefined();
      });

      it('When - 포인트를 사용하면, Then - 포인트 사용 이력이 기록되어야 한다', async () => {
        // Given
        const userId = 1;
        const initialPoint = 5000;
        const useAmount = 1000;
        await userPointTable.insertOrUpdate(userId, initialPoint);
        const pointDto: PointBody = { amount: useAmount };

        // When
        await controller.use(userId.toString(), pointDto);
        const histories: PointHistory[] =
          await pointHistoryTable.selectAllByUserId(userId);

        // Then
        const useHistory = histories.find(
          (h) => h.type === TransactionType.USE && h.amount === useAmount,
        );
        expect(useHistory).toBeDefined();
        expect(useHistory.userId).toBe(userId);
        expect(useHistory.type).toBe(TransactionType.USE);
        expect(useHistory.amount).toBe(useAmount);
      });

      it('When - 보유한 포인트 전액을 사용하면, Then - 포인트가 0이 되어야 한다', async () => {
        // Given
        const userId = 1;
        const initialPoint = 3000;
        await userPointTable.insertOrUpdate(userId, initialPoint);
        const pointDto: PointBody = { amount: initialPoint };

        // When
        const result: UserPoint = await controller.use(
          userId.toString(),
          pointDto,
        );

        // Then
        expect(result.point).toBe(0);
      });
    });

    describe('Given - 유저가 포인트가 부족한 경우', () => {
      it('When - 보유한 포인트보다 많은 금액을 사용하려고 하면, Then - 에러를 발생시켜야 한다', async () => {
        // Given
        const userId = 1;
        const initialPoint = 1000;
        const useAmount = 1500;
        await userPointTable.insertOrUpdate(userId, initialPoint);
        const pointDto: PointBody = { amount: useAmount };

        // When & Then
        await expect(
          controller.use(userId.toString(), pointDto),
        ).rejects.toThrow('포인트가 부족합니다');
      });

      it('When - 포인트가 0인 유저가 포인트를 사용하려고 하면, Then - 에러를 발생시켜야 한다', async () => {
        // Given
        const userId = 1;
        const useAmount = 100;
        await userPointTable.insertOrUpdate(userId, 0);
        const pointDto: PointBody = { amount: useAmount };

        // When & Then
        await expect(
          controller.use(userId.toString(), pointDto),
        ).rejects.toThrow('포인트가 부족합니다');
      });

      it('When - 포인트가 없는 신규 유저가 포인트를 사용하려고 하면, Then - 에러를 발생시켜야 한다', async () => {
        // Given
        const userId = 999;
        const useAmount = 100;
        const pointDto: PointBody = { amount: useAmount };

        // When & Then
        await expect(
          controller.use(userId.toString(), pointDto),
        ).rejects.toThrow('포인트가 부족합니다');
      });
    });

    describe('Given - 잘못된 사용 금액이 제공된 경우', () => {
      it('When - 음수 금액을 사용하려고 하면, Then - 에러를 발생시켜야 한다', async () => {
        // Given
        const userId = 1;
        const invalidAmount = -500;
        await userPointTable.insertOrUpdate(userId, 5000);
        const pointDto: PointBody = { amount: invalidAmount };

        // When & Then
        await expect(
          controller.use(userId.toString(), pointDto),
        ).rejects.toThrow();
      });

      it('When - 0원을 사용하려고 하면, Then - 에러를 발생시켜야 한다', async () => {
        // Given
        const userId = 1;
        const invalidAmount = 0;
        await userPointTable.insertOrUpdate(userId, 5000);
        const pointDto: PointBody = { amount: invalidAmount };

        // When & Then
        await expect(
          controller.use(userId.toString(), pointDto),
        ).rejects.toThrow();
      });

      it('When - 정수가 아닌 금액을 사용하려고 하면, Then - 에러를 발생시켜야 한다', async () => {
        // Given
        const userId = 1;
        const invalidAmount = 100.5;
        await userPointTable.insertOrUpdate(userId, 5000);
        const pointDto: PointBody = { amount: invalidAmount };

        // When & Then
        await expect(
          controller.use(userId.toString(), pointDto),
        ).rejects.toThrow();
      });
    });
  });

  describe('동시성 테스트 - 포인트 충전과 사용이 동시에 발생하는 경우', () => {
    it('Given - 동일 유저에 대해, When - 여러 건의 충전이 동시에 발생하면, Then - 모든 충전이 정확히 반영되어야 한다', async () => {
      // Given
      const userId = 1;
      const chargeAmount = 100;
      const chargeCount = 10;
      const pointDto: PointBody = { amount: chargeAmount };

      // When
      const promises = Array(chargeCount)
        .fill(null)
        .map(() => controller.charge(userId.toString(), pointDto));
      await Promise.all(promises);

      const result: UserPoint = await controller.point(userId.toString());

      // Then
      expect(result.point).toBe(chargeAmount * chargeCount);
    });

    it('Given - 동일 유저에 대해, When - 충전과 사용이 동시에 발생하면, Then - 최종 포인트가 정확히 계산되어야 한다', async () => {
      // Given
      const userId = 1;
      await userPointTable.insertOrUpdate(userId, 10000);
      const chargeDto: PointBody = { amount: 1000 };
      const useDto: PointBody = { amount: 500 };

      // When
      await Promise.all([
        controller.charge(userId.toString(), chargeDto),
        controller.charge(userId.toString(), chargeDto),
        controller.use(userId.toString(), useDto),
        controller.charge(userId.toString(), chargeDto),
        controller.use(userId.toString(), useDto),
      ]);

      const result: UserPoint = await controller.point(userId.toString());

      // Then
      // 초기: 10000 + 충전: 3000 - 사용: 1000 = 12000
      expect(result.point).toBe(12000);
    });

    it('Given - 동일 유저에 대해, When - 잔액을 초과하는 동시 사용 요청이 발생하면, Then - 일부 요청은 실패해야 한다', async () => {
      // Given
      const userId = 1;
      await userPointTable.insertOrUpdate(userId, 1000);
      const useDto: PointBody = { amount: 600 };

      // When
      const results = await Promise.allSettled([
        controller.use(userId.toString(), useDto),
        controller.use(userId.toString(), useDto),
        controller.use(userId.toString(), useDto),
      ]);

      // Then
      const successCount = results.filter(
        (r) => r.status === 'fulfilled',
      ).length;
      const failureCount = results.filter(
        (r) => r.status === 'rejected',
      ).length;

      expect(successCount).toBe(1); // 하나만 성공
      expect(failureCount).toBe(2); // 나머지는 실패

      const finalPoint: UserPoint = await controller.point(userId.toString());
      expect(finalPoint.point).toBe(400); // 1000 - 600 = 400
    });
  });
});
