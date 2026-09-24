import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrderItemEntity } from '../../orders/entities/order-item.entity';
import { InventoryLogEntity } from '../../inventory/entities/inventory-log.entity';

@Entity({ name: 'products' })
export class ProductEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', unsigned: true })
  price_cents: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  stock: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @OneToMany(() => OrderItemEntity, (item) => item.product)
  order_items: OrderItemEntity[];

  @OneToMany(() => InventoryLogEntity, (log) => log.product)
  inventory_logs: InventoryLogEntity[];
}
