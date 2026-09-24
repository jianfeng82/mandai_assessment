import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { OrderEntity } from './order.entity';
import { ProductEntity } from '../../products/entities/product.entity';

@Entity({ name: 'order_items' })
export class OrderItemEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  order_id: string;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  @Column({ type: 'varchar', length: 36 })
  product_id: string;

  @ManyToOne(() => ProductEntity, (product) => product.order_items)
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column({ type: 'int', unsigned: true })
  quantity: number;

  @Column({ type: 'int', unsigned: true })
  unit_price_cents: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}
