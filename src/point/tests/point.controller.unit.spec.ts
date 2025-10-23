import { Test, TestingModule } from '@nestjs/testing';
import { PointController } from '../point.controller';
import { PointService } from '../point.service';
import { UserPoint, PointHistory, TransactionType } from '../point.model';
import { PointBody } from '../point.dto';

describe('PointController - Unit Tests', () => {
  let controller: PointController;
  let mockService: jest.Mocked<PointService>;

  beforeEach(async () => {
    // Mock Service 생성
    mockService = {
      getPoint: jest.fn(),
      chargePoint: jest.fn(),
      usePoint: jest.fn(),
      getPointHistories: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PointController],
      providers: [
        {
          provide: PointService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<PointController>(PointController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('point - GET /point/:id', () => {
    it('유효한 id로 요청하면 Service.getPoint를 호출한다', async () => {
      // Given
      const userId = 1;
      const mockUserPoint: UserPoint = {
        id: userId,
        point: 5000,
        updateMillis: Date.now(),
      };
      mockService.getPoint.mockResolvedValue(mockUserPoint);

      // When
      const result = await controller.point(userId);

      // Then
      expect(mockService.getPoint).toHaveBeenCalledWith(userId);
      expect(mockService.getPoint).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUserPoint);
    });

    it('Service에서 에러가 발생하면 그대로 전파한다', async () => {
      // Given
      const userId = 1;
      const error = new Error('Service error');
      mockService.getPoint.mockRejectedValue(error);

      // When & Then
      await expect(controller.point(userId)).rejects.toThrow('Service error');
    });
  });

  describe('history - GET /point/:id/histories', () => {
    it('유효한 id로 요청하면 Service.getPointHistories를 호출한다', async () => {
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
      mockService.getPointHistories.mockResolvedValue(mockHistories);

      // When
      const result = await controller.history(userId);

      // Then
      expect(mockService.getPointHistories).toHaveBeenCalledWith(userId);
      expect(mockService.getPointHistories).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockHistories);
    });

    it('이력이 없으면 빈 배열을 반환한다', async () => {
      // Given
      const userId = 999;
      mockService.getPointHistories.mockResolvedValue([]);

      // When
      const result = await controller.history(userId);

      // Then
      expect(result).toEqual([]);
    });
  });

  describe('charge - PATCH /point/:id/charge', () => {
    it('유효한 요청으로 충전하면 Service.chargePoint를 호출한다', async () => {
      // Given
      const userId = 1;
      const chargeAmount = 1000;
      const pointDto: PointBody = { amount: chargeAmount };
      const mockUserPoint: UserPoint = {
        id: userId,
        point: 6000,
        updateMillis: Date.now(),
      };
      mockService.chargePoint.mockResolvedValue(mockUserPoint);

      // When
      const result = await controller.charge(userId, pointDto);

      // Then
      expect(mockService.chargePoint).toHaveBeenCalledWith(
        userId,
        chargeAmount,
      );
      expect(mockService.chargePoint).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUserPoint);
    });

    it('Service에서 검증 에러가 발생하면 그대로 전파한다', async () => {
      // Given
      const userId = 1;
      const invalidAmount = -500;
      const pointDto: PointBody = { amount: invalidAmount };
      mockService.chargePoint.mockRejectedValue(
        new Error('포인트는 0보다 커야 합니다'),
      );

      // When & Then
      await expect(controller.charge(userId, pointDto)).rejects.toThrow(
        '포인트는 0보다 커야 합니다',
      );
    });
  });

  describe('use - PATCH /point/:id/use', () => {
    it('유효한 요청으로 사용하면 Service.usePoint를 호출한다', async () => {
      // Given
      const userId = 1;
      const useAmount = 2000;
      const pointDto: PointBody = { amount: useAmount };
      const mockUserPoint: UserPoint = {
        id: userId,
        point: 3000,
        updateMillis: Date.now(),
      };
      mockService.usePoint.mockResolvedValue(mockUserPoint);

      // When
      const result = await controller.use(userId, pointDto);

      // Then
      expect(mockService.usePoint).toHaveBeenCalledWith(userId, useAmount);
      expect(mockService.usePoint).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUserPoint);
    });

    it('잔액 부족 시 Service 에러를 그대로 전파한다', async () => {
      // Given
      const userId = 1;
      const useAmount = 10000;
      const pointDto: PointBody = { amount: useAmount };
      mockService.usePoint.mockRejectedValue(new Error('포인트가 부족합니다'));

      // When & Then
      await expect(controller.use(userId, pointDto)).rejects.toThrow(
        '포인트가 부족합니다',
      );
    });
  });

});
