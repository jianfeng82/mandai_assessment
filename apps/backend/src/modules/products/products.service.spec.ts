import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductEntity } from './entities/product.entity';
import { InventoryService } from '../inventory/inventory.service';

describe('ProductsService (Unit Tests)', () => {
  let service: ProductsService;
  let mockProductRepository: any;
  let mockInventoryService: any;
  let mockQueryRunner: any;
  let mockDataSource: any;

  const mockProduct: ProductEntity = {
    id: 'prod-001',
    title: 'Mechanical Keyboard Switches',
    description: 'Pack of 10 linear switches',
    price_cents: 4500,
    stock: 20,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    mockProductRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
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
        findOne: jest.fn(),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: mockProductRepository,
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return list of active products', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockProduct]),
      };
      mockProductRepository.createQueryBuilder.mockReturnValue(qb);

      const products = await service.findAll();
      expect(products).toHaveLength(1);
      expect(products[0].title).toBe('Mechanical Keyboard Switches');
    });
  });

  describe('findOne', () => {
    it('should return a product when found', async () => {
      mockProductRepository.findOne.mockResolvedValue(mockProduct);
      const product = await service.findOne('prod-001');
      expect(product.id).toBe('prod-001');
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('adjustStock', () => {
    it('should throw BadRequestException if adjustment would result in negative stock', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockProduct,
        stock: 5,
      });

      await expect(
        service.adjustStock('prod-001', -10, 'admin-1', 'REDUCTION'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully restock inventory and log movement', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue({
        ...mockProduct,
        stock: 20,
      });
      mockQueryRunner.manager.query.mockResolvedValue({ affectedRows: 1 });
      mockProductRepository.findOne.mockResolvedValue({
        ...mockProduct,
        stock: 35,
      });

      const result = await service.adjustStock(
        'prod-001',
        15,
        'admin-1',
        'RESTOCK_SHIPMENT',
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.stock).toBe(35);
      expect(mockInventoryService.logMovement).toHaveBeenCalled();
    });
  });
});
