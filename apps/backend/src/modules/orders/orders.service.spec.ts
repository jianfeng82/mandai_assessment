import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderEntity, OrderStatus } from './entities/order.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { RedisService } from '../redis/redis.service';
import { InventoryService } from '../inventory/inventory.service';

describe('OrdersService (Unit Tests)', () => {
  let service: OrdersService;
  let mockRedisService: any;
  let mockInventoryService: any;
  let mockQueryRunner: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockRedisService = {
      getIdempotencyRecord: jest.fn().mockResolvedValue(null),
      setIdempotencyRecord: jest.fn().mockResolvedValue(undefined),
      acquireLock: jest.fn().mockResolvedValue('mock-uuid-token'),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    mockInventoryService = {
      logMovement: jest.fn().mockResolvedValue(undefined),
    };

    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        query: jest.fn(),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(OrderEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: {},
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buy validation & locking', () => {
    it('should throw BadRequestException if quantity is zero or negative', async () => {
      await expect(
        service.buy('user-1', { productId: 'p1', quantity: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return cached response if Idempotency-Key already exists in Redis', async () => {
      const cachedReceipt = {
        id: 'ord-cached-123',
        user_id: 'user-1',
        status: OrderStatus.PAID,
        total_cents: 4500,
        total_dollars: '45.00',
        idempotency_key: 'idem-key-1',
        item: {
          product_id: 'p1',
          title: 'Product 1',
          quantity: 1,
          unit_price_cents: 4500,
        },
        remaining_stock: 9,
        created_at: new Date().toISOString(),
      };
      mockRedisService.getIdempotencyRecord.mockResolvedValue(cachedReceipt);

      const result = await service.buy(
        'user-1',
        { productId: 'p1', quantity: 1 },
        'idem-key-1',
      );
      expect(result.id).toBe('ord-cached-123');
      expect(result.is_idempotent_replay).toBe(true);
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if per-user distributed lock is already held', async () => {
      mockRedisService.acquireLock.mockResolvedValue(null);

      await expect(
        service.buy('user-1', { productId: 'p1', quantity: 1 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('atomic conditional concurrency execution', () => {
    it('should throw NotFoundException if product is not in database', async () => {
      mockQueryRunner.manager.query.mockResolvedValueOnce([]);

      await expect(
        service.buy('user-1', { productId: 'p-missing', quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw ConflictException when atomic conditional update affectedRows is 0 (Out of Stock)', async () => {
      mockQueryRunner.manager.query.mockResolvedValueOnce([
        {
          id: 'p1',
          title: 'Test Product',
          price_cents: 4500,
          stock: 0,
          is_active: 1,
        },
      ]);
      mockQueryRunner.manager.query.mockResolvedValueOnce({ affectedRows: 0 });

      await expect(
        service.buy('user-1', { productId: 'p1', quantity: 1 }),
      ).rejects.toThrow(ConflictException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should successfully complete order when stock is available', async () => {
      mockQueryRunner.manager.query.mockImplementation(async (sql: string) => {
        await Promise.resolve();
        if (sql.includes('SELECT id, title')) {
          return [
            {
              id: 'p1',
              title: 'Test Product',
              price_cents: 4500,
              stock: 10,
              is_active: 1,
            },
          ];
        }
        if (sql.includes('UPDATE products')) {
          return { affectedRows: 1 };
        }
        if (sql.includes('SELECT stock')) {
          return [{ stock: 9 }];
        }
        return { insertId: 1 };
      });

      const receipt = await service.buy(
        'user-1',
        { productId: 'p1', quantity: 1 },
        'idem-success-1',
      );

      expect(receipt.status).toBe(OrderStatus.PAID);
      expect(receipt.total_cents).toBe(4500);
      expect(receipt.remaining_stock).toBe(9);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockRedisService.releaseLock).toHaveBeenCalled();
      expect(mockRedisService.setIdempotencyRecord).toHaveBeenCalled();
    });
  });
});
