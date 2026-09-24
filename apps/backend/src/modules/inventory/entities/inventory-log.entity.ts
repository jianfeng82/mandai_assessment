import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProductEntity } from '../../products/entities/product.entity';

export enum InventoryChangeReason {
  PURCHASE = 'PURCHASE',
  ADMIN_RESTOCK = 'ADMIN_RESTOCK',
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
}

@Entity({ name: 'inventory_logs' })
export class InventoryLogEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  product_id: string;

  @ManyToOne(() => ProductEntity, (product) => product.inventory_logs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column({ type: 'int' })
  change_amount: number;

  @Column({ type: 'int', unsigned: true })
  balance_after: number;

  @Column({
    type: 'enum',
    enum: InventoryChangeReason,
  })
  reason: InventoryChangeReason;

  @Column({ type: 'varchar', length: 64, nullable: true })
  reference_id: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}
