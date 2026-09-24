import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  InventoryLogEntity,
  InventoryChangeReason,
} from './entities/inventory-log.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryLogEntity)
    private readonly logRepository: Repository<InventoryLogEntity>,
  ) {}

  /**
   * Records an immutable inventory movement log inside a transaction manager
   */
  async logMovement(
    productId: string,
    changeAmount: number,
    balanceAfter: number,
    reason: InventoryChangeReason,
    referenceId?: string,
    manager?: EntityManager,
  ): Promise<InventoryLogEntity> {
    const repo = manager
      ? manager.getRepository(InventoryLogEntity)
      : this.logRepository;

    const log = repo.create({
      id: randomUUID(),
      product_id: productId,
      change_amount: changeAmount,
      balance_after: balanceAfter,
      reason,
      reference_id: referenceId || null,
    });

    return repo.save(log);
  }

  /**
   * Admin audit log retrieval
   */
  async getLogs(productId?: string, limit = 50) {
    const qb = this.logRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.product', 'product')
      .orderBy('log.created_at', 'DESC')
      .take(limit);

    if (productId) {
      qb.where('log.product_id = :productId', { productId });
    }

    return qb.getMany();
  }
}
