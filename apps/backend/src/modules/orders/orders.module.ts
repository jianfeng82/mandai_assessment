import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { UserLockInterceptor } from '../../core/interceptors/user-lock.interceptor';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, ProductEntity]),
    InventoryModule,
  ],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, UserLockInterceptor],
  exports: [OrdersService, UserLockInterceptor],
})
export class OrdersModule {}
