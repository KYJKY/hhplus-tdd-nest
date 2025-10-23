import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PointService } from '../point.service';
import { IPointRepository } from '../point.repository.interface';
import { UserPoint, PointHistory, TransactionType } from '../point.model';

describe('PointService - Unit Tests', () => {
  let service: PointService;
  let mockRepository: jest.Mocked<IPointRepository>;

  beforeEach(async () => {
    // Mock Repository 생성
    mockRepository = {
      getUserPoint: jest.fn(),
      updateUserPoint: jest.fn(),
      addPointHistory: jest.fn(),
      getPointHistories: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointService,
        {
          provide: 'IPointRepository',
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PointService>(PointService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPoint - 포인트 조회', () => {
    it('유효한 userId로 조회하면 Repository에서 포인트를 가져온다', async () => {
      // Given
      const userId = 1;
      const mockUserPoint: UserPoint = {
        id: userId,
        point: 5000,
        updateMillis: Date.now(),
      };
      mockRepository.getUserPoint.mockResolvedValue(mockUserPoint);

      // When
      const result = await service.getPoint(userId);

      // Then
      expect(mockRepository.getUserPoint).toHaveBeenCalledWith(userId);
      expect(mockRepository.getUserPoint).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUserPoint);
    });

    it('음수 userId는 에러를 던진다', async () => {
      // Given
      const invalidUserId = -1;

      // When & Then
      await expect(service.getPoint(invalidUserId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getPoint(invalidUserId)).rejects.toThrow(
        '올바르지 않은 ID 값 입니다.',
      );
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });

    it('0인 userId는 에러를 던진다', async () => {
      // Given
      const invalidUserId = 0;

      // When & Then
      await expect(service.getPoint(invalidUserId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });

    it('정수가 아닌 userId는 에러를 던진다', async () => {
      // Given
      const invalidUserId = 1.5;

      // When & Then
      await expect(service.getPoint(invalidUserId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });
  });

  describe('chargePoint - 포인트 충전', () => {
    it('유효한 금액으로 충전하면 포인트가 증가한다', async () => {
      // Given
      const userId = 1;
      const currentPoint = 1000;
      const chargeAmount = 500;
      const expectedNewPoint = 1500;

      mockRepository.getUserPoint.mockResolvedValue({
        id: userId,
        point: currentPoint,
        updateMillis: Date.now(),
      });

      const updatedUserPoint: UserPoint = {
        id: userId,
        point: expectedNewPoint,
        updateMillis: Date.now(),
      };
      mockRepository.updateUserPoint.mockResolvedValue(updatedUserPoint);

      mockRepository.addPointHistory.mockResolvedValue({
        id: 1,
        userId,
        amount: chargeAmount,
        type: TransactionType.CHARGE,
        timeMillis: Date.now(),
      });

      // When
      const result = await service.chargePoint(userId, chargeAmount);

      // Then
      expect(mockRepository.getUserPoint).toHaveBeenCalledWith(userId);
      expect(mockRepository.updateUserPoint).toHaveBeenCalledWith(
        userId,
        expectedNewPoint,
      );
      expect(mockRepository.addPointHistory).toHaveBeenCalledWith(
        userId,
        chargeAmount,
        TransactionType.CHARGE,
        expect.any(Number),
      );
      expect(result.point).toBe(expectedNewPoint);
    });

    it('음수 금액으로 충전하면 에러를 던진다', async () => {
      // Given
      const userId = 1;
      const invalidAmount = -500;

      // When & Then
      await expect(service.chargePoint(userId, invalidAmount)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.chargePoint(userId, invalidAmount)).rejects.toThrow(
        '포인트는 0보다 커야 합니다',
      );
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });

    it('0원으로 충전하면 에러를 던진다', async () => {
      // Given
      const userId = 1;
      const invalidAmount = 0;

      // When & Then
      await expect(service.chargePoint(userId, invalidAmount)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });

    it('정수가 아닌 금액으로 충전하면 에러를 던진다', async () => {
      // Given
      const userId = 1;
      const invalidAmount = 100.5;

      // When & Then
      await expect(service.chargePoint(userId, invalidAmount)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.chargePoint(userId, invalidAmount)).rejects.toThrow(
        '포인트는 정수만 가능합니다',
      );
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });

    it('최대값을 초과하는 금액으로 충전하면 에러를 던진다', async () => {
      // Given
      const userId = 1;
      const invalidAmount = 10000001;

      // When & Then
      await expect(service.chargePoint(userId, invalidAmount)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });

    it('충전 후 포인트가 최대값을 초과하면 에러를 던진다', async () => {
      // Given
      const userId = 1;
      const currentPoint = 9999900;
      const chargeAmount = 200;

      mockRepository.getUserPoint.mockResolvedValue({
        id: userId,
        point: currentPoint,
        updateMillis: Date.now(),
      });

      // When & Then
      await expect(service.chargePoint(userId, chargeAmount)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.chargePoint(userId, chargeAmount)).rejects.toThrow(
        '포인트가 최대값을 초과합니다',
      );
      expect(mockRepository.updateUserPoint).not.toHaveBeenCalled();
    });

    it('충전 성공 시 이력이 기록된다', async () => {
      // Given
      const userId = 1;
      const chargeAmount = 1000;

      mockRepository.getUserPoint.mockResolvedValue({
        id: userId,
        point: 5000,
        updateMillis: Date.now(),
      });

      mockRepository.updateUserPoint.mockResolvedValue({
        id: userId,
        point: 6000,
        updateMillis: 123456789,
      });

      mockRepository.addPointHistory.mockResolvedValue({
        id: 1,
        userId,
        amount: chargeAmount,
        type: TransactionType.CHARGE,
        timeMillis: 123456789,
      });

      // When
      await service.chargePoint(userId, chargeAmount);

      // Then
      expect(mockRepository.addPointHistory).toHaveBeenCalledWith(
        userId,
        chargeAmount,
        TransactionType.CHARGE,
        123456789,
      );
    });

    it('1건당 최대 100만원까지 충전 가능하다', async () => {
      // Given
      const userId = 1;
      const maxChargeAmount = 1000000; // 100만원

      mockRepository.getUserPoint.mockResolvedValue({
        id: userId,
        point: 0,
        updateMillis: Date.now(),
      });

      mockRepository.updateUserPoint.mockResolvedValue({
        id: userId,
        point: maxChargeAmount,
        updateMillis: Date.now(),
      });

      mockRepository.addPointHistory.mockResolvedValue({
        id: 1,
        userId,
        amount: maxChargeAmount,
        type: TransactionType.CHARGE,
        timeMillis: Date.now(),
      });

      // When
      const result = await service.chargePoint(userId, maxChargeAmount);

      // Then
      expect(result.point).toBe(maxChargeAmount);
    });

    it('100만원을 초과하는 금액은 1건당 충전할 수 없다', async () => {
      // Given
      const userId = 1;
      const overMaxAmount = 1000001; // 100만원 + 1원

      // When & Then
      await expect(service.chargePoint(userId, overMaxAmount)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.chargePoint(userId, overMaxAmount)).rejects.toThrow(
        '1건당 최대 충전 금액은 1000000원 입니다',
      );
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });

    it('경계값: 999,999원 충전은 성공한다', async () => {
      // Given
      const userId = 1;
      const boundaryAmount = 999999;

      mockRepository.getUserPoint.mockResolvedValue({
        id: userId,
        point: 0,
        updateMillis: Date.now(),
      });

      mockRepository.updateUserPoint.mockResolvedValue({
        id: userId,
        point: boundaryAmount,
        updateMillis: Date.now(),
      });

      mockRepository.addPointHistory.mockResolvedValue({
        id: 1,
        userId,
        amount: boundaryAmount,
        type: TransactionType.CHARGE,
        timeMillis: Date.now(),
      });

      // When
      const result = await service.chargePoint(userId, boundaryAmount);

      // Then
      expect(result.point).toBe(boundaryAmount);
    });

    it('경계값: 1,000,001원 충전은 실패한다', async () => {
      // Given
      const userId = 1;
      const overBoundaryAmount = 1000001;

      // When & Then
      await expect(
        service.chargePoint(userId, overBoundaryAmount),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });
  });

  describe('usePoint - 포인트 사용', () => {
    it('잔액이 충분하면 포인트가 차감된다', async () => {
      // Given
      const userId = 1;
      const currentPoint = 5000;
      const useAmount = 2000;
      const expectedNewPoint = 3000;

      mockRepository.getUserPoint.mockResolvedValue({
        id: userId,
        point: currentPoint,
        updateMillis: Date.now(),
      });

      const updatedUserPoint: UserPoint = {
        id: userId,
        point: expectedNewPoint,
        updateMillis: Date.now(),
      };
      mockRepository.updateUserPoint.mockResolvedValue(updatedUserPoint);

      mockRepository.addPointHistory.mockResolvedValue({
        id: 1,
        userId,
        amount: useAmount,
        type: TransactionType.USE,
        timeMillis: Date.now(),
      });

      // When
      const result = await service.usePoint(userId, useAmount);

      // Then
      expect(mockRepository.getUserPoint).toHaveBeenCalledWith(userId);
      expect(mockRepository.updateUserPoint).toHaveBeenCalledWith(
        userId,
        expectedNewPoint,
      );
      expect(mockRepository.addPointHistory).toHaveBeenCalledWith(
        userId,
        useAmount,
        TransactionType.USE,
        expect.any(Number),
      );
      expect(result.point).toBe(expectedNewPoint);
    });

    it('잔액이 부족하면 에러를 던진다', async () => {
      // Given
      const userId = 1;
      const currentPoint = 1000;
      const useAmount = 1500;

      mockRepository.getUserPoint.mockResolvedValue({
        id: userId,
        point: currentPoint,
        updateMillis: Date.now(),
      });

      // When & Then
      await expect(service.usePoint(userId, useAmount)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.usePoint(userId, useAmount)).rejects.toThrow(
        '포인트가 부족합니다',
      );
      expect(mockRepository.updateUserPoint).not.toHaveBeenCalled();
    });

    it('포인트가 0일 때 사용하면 에러를 던진다', async () => {
      // Given
      const userId = 1;
      const currentPoint = 0;
      const useAmount = 100;

      mockRepository.getUserPoint.mockResolvedValue({
        id: userId,
        point: currentPoint,
        updateMillis: Date.now(),
      });

      // When & Then
      await expect(service.usePoint(userId, useAmount)).rejects.toThrow(
        '포인트가 부족합니다',
      );
      expect(mockRepository.updateUserPoint).not.toHaveBeenCalled();
    });

    it('전액 사용하면 포인트가 0이 된다', async () => {
      // Given
      const userId = 1;
      const currentPoint = 3000;
      const useAmount = 3000;

      mockRepository.getUserPoint.mockResolvedValue({
        id: userId,
        point: currentPoint,
        updateMillis: Date.now(),
      });

      mockRepository.updateUserPoint.mockResolvedValue({
        id: userId,
        point: 0,
        updateMillis: Date.now(),
      });

      mockRepository.addPointHistory.mockResolvedValue({
        id: 1,
        userId,
        amount: useAmount,
        type: TransactionType.USE,
        timeMillis: Date.now(),
      });

      // When
      const result = await service.usePoint(userId, useAmount);

      // Then
      expect(result.point).toBe(0);
    });

    it('음수 금액으로 사용하면 에러를 던진다', async () => {
      // Given
      const userId = 1;
      const invalidAmount = -500;

      // When & Then
      await expect(service.usePoint(userId, invalidAmount)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });

    it('사용 성공 시 이력이 기록된다', async () => {
      // Given
      const userId = 1;
      const useAmount = 1000;

      mockRepository.getUserPoint.mockResolvedValue({
        id: userId,
        point: 5000,
        updateMillis: Date.now(),
      });

      mockRepository.updateUserPoint.mockResolvedValue({
        id: userId,
        point: 4000,
        updateMillis: 987654321,
      });

      mockRepository.addPointHistory.mockResolvedValue({
        id: 1,
        userId,
        amount: useAmount,
        type: TransactionType.USE,
        timeMillis: 987654321,
      });

      // When
      await service.usePoint(userId, useAmount);

      // Then
      expect(mockRepository.addPointHistory).toHaveBeenCalledWith(
        userId,
        useAmount,
        TransactionType.USE,
        987654321,
      );
    });

    it('100원 단위로 사용 가능하다', async () => {
      // Given
      const userId = 1;
      const useAmount = 100;

      mockRepository.getUserPoint.mockResolvedValue({
        id: userId,
        point: 10000,
        updateMillis: Date.now(),
      });

      mockRepository.updateUserPoint.mockResolvedValue({
        id: userId,
        point: 9900,
        updateMillis: Date.now(),
      });

      mockRepository.addPointHistory.mockResolvedValue({
        id: 1,
        userId,
        amount: useAmount,
        type: TransactionType.USE,
        timeMillis: Date.now(),
      });

      // When
      const result = await service.usePoint(userId, useAmount);

      // Then
      expect(result.point).toBe(9900);
    });

    it('200원 단위로 사용 가능하다', async () => {
      // Given
      const userId = 1;
      const useAmount = 200;

      mockRepository.getUserPoint.mockResolvedValue({
        id: userId,
        point: 10000,
        updateMillis: Date.now(),
      });

      mockRepository.updateUserPoint.mockResolvedValue({
        id: userId,
        point: 9800,
        updateMillis: Date.now(),
      });

      mockRepository.addPointHistory.mockResolvedValue({
        id: 1,
        userId,
        amount: useAmount,
        type: TransactionType.USE,
        timeMillis: Date.now(),
      });

      // When
      const result = await service.usePoint(userId, useAmount);

      // Then
      expect(result.point).toBe(9800);
    });

    it('100원 단위가 아닌 금액은 사용할 수 없다 - 50원', async () => {
      // Given
      const userId = 1;
      const invalidAmount = 50;

      // When & Then
      await expect(service.usePoint(userId, invalidAmount)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.usePoint(userId, invalidAmount)).rejects.toThrow(
        '포인트는 100원 단위로만 사용 가능합니다',
      );
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });

    it('100원 단위가 아닌 금액은 사용할 수 없다 - 99원', async () => {
      // Given
      const userId = 1;
      const invalidAmount = 99;

      // When & Then
      await expect(service.usePoint(userId, invalidAmount)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.usePoint(userId, invalidAmount)).rejects.toThrow(
        '포인트는 100원 단위로만 사용 가능합니다',
      );
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });

    it('100원 단위가 아닌 금액은 사용할 수 없다 - 150원', async () => {
      // Given
      const userId = 1;
      const invalidAmount = 150;

      // When & Then
      await expect(service.usePoint(userId, invalidAmount)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.usePoint(userId, invalidAmount)).rejects.toThrow(
        '포인트는 100원 단위로만 사용 가능합니다',
      );
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });

    it('100원 단위가 아닌 금액은 사용할 수 없다 - 1,001원', async () => {
      // Given
      const userId = 1;
      const invalidAmount = 1001;

      // When & Then
      await expect(service.usePoint(userId, invalidAmount)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.usePoint(userId, invalidAmount)).rejects.toThrow(
        '포인트는 100원 단위로만 사용 가능합니다',
      );
      expect(mockRepository.getUserPoint).not.toHaveBeenCalled();
    });
  });

  describe('getPointHistories - 포인트 이력 조회', () => {
    it('유효한 userId로 조회하면 Repository에서 이력을 가져온다', async () => {
      // Given
      const userId = 1;
      const mockHistories: PointHistory[] = [
        {
          id: 1,
          userId,
          amount: 1000,
          type: TransactionType.CHARGE,
          timeMillis: Date.now(),
        },
        {
          id: 2,
          userId,
          amount: 500,
          type: TransactionType.USE,
          timeMillis: Date.now(),
        },
      ];
      mockRepository.getPointHistories.mockResolvedValue(mockHistories);

      // When
      const result = await service.getPointHistories(userId);

      // Then
      expect(mockRepository.getPointHistories).toHaveBeenCalledWith(userId);
      expect(mockRepository.getPointHistories).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockHistories);
      expect(result.length).toBe(2);
    });

    it('이력이 없으면 빈 배열을 반환한다', async () => {
      // Given
      const userId = 999;
      mockRepository.getPointHistories.mockResolvedValue([]);

      // When
      const result = await service.getPointHistories(userId);

      // Then
      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    });

    it('잘못된 userId는 에러를 던진다', async () => {
      // Given
      const invalidUserId = -1;

      // When & Then
      await expect(service.getPointHistories(invalidUserId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.getPointHistories).not.toHaveBeenCalled();
    });
  });
});
