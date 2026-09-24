import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { OrderEntity, OrderStatus } from './entities/order.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { BuyProductDto } from './dto/buy-product.dto';
import { RedisService } from '../redis/redis.service';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryChangeReason } from '../inventory/entities/inventory-log.entity';
import { withTransactionRetry } from '../../common/utils/with-retry.util';

export interface BuyReceipt {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_cents: number;
  total_dollars: string;
  idempotency_key: string | null;
  item: {
    product_id: string;
    title: string;
    quantity: number;
    unit_price_cents: number;
  };
  remaining_stock: number;
  created_at: string;
  is_idempotent_replay?: boolean;
}

interface ProductRow {
  id: string;
  title: string;
  price_cents: number;
  stock: number;
  is_active: number | boolean;
}

interface BalanceRow {
  stock: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Concurrency-safe, race-condition-free buy implementation.
   * Employs:
   * 1. Idempotency Key Caching via Redis
   * 2. Per-User Distributed Lock via Redis (prevents accidental double-clicks)
   * 3. MySQL Atomic Conditional Update (UPDATE ... WHERE stock >= :qty)
   * 4. Single ACID Transaction wrapping Order, OrderItem, and Audit Log
   * 5. Deadlock & Lock Wait Timeout retry loop
   */
  async buy(
    userId: string,
    dto: BuyProductDto,
    idempotencyKey?: string,
  ): Promise<BuyReceipt> {
    const { productId, quantity } = dto;

    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    // 1. Idempotency Check
    if (idempotencyKey) {
      const cachedOrder =
        await this.redisService.getIdempotencyRecord<BuyReceipt>(
          idempotencyKey,
        );
      if (cachedOrder) {
        this.logger.log(
          `Idempotency hit for key ${idempotencyKey}. Returning cached response.`,
        );
        return {
          ...cachedOrder,
          is_idempotent_replay: true,
        };
      }
    }

    // 2. User-level Distributed Lock (prevents duplicate submissions from the same user)
    const lockKey = `user:${userId}:buy`;
    const lockToken = await this.redisService.acquireLock(lockKey, 10000);
    if (!lockToken) {
      throw new ConflictException(
        'An order is already being processed for your account. Please wait.',
      );
    }

    try {
      // 3. Execute order inside atomic retry utility
      const result = await withTransactionRetry<BuyReceipt>(
        async () => {
          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            // Verify product existence and active status
            const productRows = (await queryRunner.manager.query(
              `SELECT id, title, price_cents, stock, is_active FROM products WHERE id = ? LIMIT 1`,
              [productId],
            )) as unknown as ProductRow[];

            if (!productRows || productRows.length === 0) {
              throw new NotFoundException(`Product ${productId} not found`);
            }

            const product = productRows[0];
            if (!product.is_active) {
              throw new BadRequestException(
                `Product '${product.title}' is inactive`,
              );
            }

            // 4. ATOMIC CONDITIONAL UPDATE:
            // The single-statement test-and-set boundary.
            // Subtracts quantity ONLY if current stock >= quantity.
            const updateResult = (await queryRunner.manager.query(
              `UPDATE products 
             SET stock = stock - ? 
             WHERE id = ? AND is_active = 1 AND stock >= ?`,
              [quantity, productId, quantity],
            )) as unknown as { affectedRows: number };

            if (updateResult.affectedRows === 0) {
              // Predicate check failed! Stock is insufficient or sold out.
              throw new ConflictException(
                `Product '${product.title}' is out of stock or insufficient quantity available.`,
              );
            }

            // Fetch post-deduction stock for immutable ledger
            const balanceRows = (await queryRunner.manager.query(
              `SELECT stock FROM products WHERE id = ? LIMIT 1`,
              [productId],
            )) as unknown as BalanceRow[];
            const balanceAfter = balanceRows[0].stock;

            const totalCents = product.price_cents * quantity;
            const orderId = randomUUID();
            const orderItemId = randomUUID();

            // Insert Order
            await queryRunner.manager.query(
              `INSERT INTO orders (id, user_id, status, total_cents, idempotency_key, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
              [
                orderId,
                userId,
                OrderStatus.PAID,
                totalCents,
                idempotencyKey || null,
              ],
            );

            // Insert Order Item
            await queryRunner.manager.query(
              `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price_cents, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
              [orderItemId, orderId, productId, quantity, product.price_cents],
            );

            // Insert Inventory Audit Log
            await this.inventoryService.logMovement(
              productId,
              -quantity,
              balanceAfter,
              InventoryChangeReason.PURCHASE,
              orderId,
              queryRunner.manager,
            );

            await queryRunner.commitTransaction();

            return {
              id: orderId,
              user_id: userId,
              status: OrderStatus.PAID,
              total_cents: totalCents,
              total_dollars: (totalCents / 100).toFixed(2),
              idempotency_key: idempotencyKey || null,
              item: {
                product_id: productId,
                title: product.title,
                quantity,
                unit_price_cents: product.price_cents,
              },
              remaining_stock: balanceAfter,
              created_at: new Date().toISOString(),
            };
          } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
          } finally {
            await queryRunner.release();
          }
        },
        3,
        50,
        this.logger,
      );

      // 5. Store Idempotency Response if key provided
      if (idempotencyKey) {
        await this.redisService.setIdempotencyRecord(idempotencyKey, result);
      }

      return result;
    } finally {
      // 6. Safe Lock Release
      await this.redisService.releaseLock(lockKey, lockToken);
    }
  }

  async getMyOrders(userId: string) {
    return this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .where('order.user_id = :userId', { userId })
      .orderBy('order.created_at', 'DESC')
      .getMany();
  }

  async getAllOrders() {
    return this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .orderBy('order.created_at', 'DESC')
      .getMany();
  }
}
