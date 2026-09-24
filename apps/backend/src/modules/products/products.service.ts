import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { ProductEntity } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryChangeReason } from '../inventory/entities/inventory-log.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly inventoryService: InventoryService,
  ) {}

  async findAll(onlyActive = true, search?: string): Promise<ProductEntity[]> {
    const qb = this.productRepository.createQueryBuilder('product');

    if (onlyActive) {
      qb.where('product.is_active = :isActive', { isActive: true });
    }

    if (search) {
      qb.andWhere(
        '(product.title LIKE :search OR product.description LIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('product.created_at', 'DESC');
    return qb.getMany();
  }

  async findOne(id: string): Promise<ProductEntity> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async create(createDto: CreateProductDto): Promise<ProductEntity> {
    const product = this.productRepository.create({
      id: randomUUID(),
      title: createDto.title,
      description: createDto.description,
      price_cents: createDto.price_cents,
      stock: createDto.stock,
      is_active: createDto.is_active ?? true,
    });

    const saved = await this.productRepository.save(product);

    if (createDto.stock > 0) {
      await this.inventoryService.logMovement(
        saved.id,
        createDto.stock,
        createDto.stock,
        InventoryChangeReason.ADMIN_RESTOCK,
        'PRODUCT_CREATION',
      );
    }

    return saved;
  }

  async update(
    id: string,
    updateDto: UpdateProductDto,
  ): Promise<ProductEntity> {
    const product = await this.findOne(id);

    if (updateDto.title !== undefined) product.title = updateDto.title;
    if (updateDto.description !== undefined)
      product.description = updateDto.description;
    if (updateDto.price_cents !== undefined)
      product.price_cents = updateDto.price_cents;
    if (updateDto.is_active !== undefined)
      product.is_active = updateDto.is_active;

    return this.productRepository.save(product);
  }

  async adjustStock(
    id: string,
    amount: number,
    adminId: string,
    customReason?: string,
  ): Promise<ProductEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await queryRunner.manager.findOne(ProductEntity, {
        where: { id },
      });
      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      const newStock = product.stock + amount;
      if (newStock < 0) {
        throw new BadRequestException(
          `Cannot reduce stock by ${Math.abs(amount)}. Current stock is ${product.stock}.`,
        );
      }

      if (amount < 0) {
        // Atomic conditional check to guarantee non-negative decrement
        const result = (await queryRunner.manager.query(
          `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`,
          [Math.abs(amount), id, Math.abs(amount)],
        )) as unknown as { affectedRows: number };
        if (result.affectedRows === 0) {
          throw new BadRequestException(
            `Insufficient stock to perform reduction. Current stock is lower than ${Math.abs(amount)}.`,
          );
        }
      } else {
        await queryRunner.manager.query(
          `UPDATE products SET stock = stock + ? WHERE id = ?`,
          [amount, id],
        );
      }

      const reason =
        amount > 0
          ? InventoryChangeReason.ADMIN_RESTOCK
          : InventoryChangeReason.ADMIN_ADJUSTMENT;

      await this.inventoryService.logMovement(
        id,
        amount,
        newStock,
        reason,
        customReason || `ADMIN_${adminId}`,
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      return this.findOne(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const product = await this.findOne(id);
    product.is_active = false;
    await this.productRepository.save(product);
    return {
      success: true,
      message: `Product ${product.title} has been deactivated.`,
    };
  }
}
