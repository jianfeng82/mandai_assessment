import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import { DatabaseModule } from './core/database/database.module';
import { LoggerModule } from './common/logger/logger.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { UserEntity } from './modules/auth/entities/user.entity';
import { ProductEntity } from './modules/products/entities/product.entity';
import { OrderEntity } from './modules/orders/entities/order.entity';
import { OrderItemEntity } from './modules/orders/entities/order-item.entity';
import { InventoryLogEntity } from './modules/inventory/entities/inventory-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    LoggerModule,
    DatabaseModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', '127.0.0.1'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USER', 'appuser'),
        password: config.get<string>('DB_PASSWORD', 'apppassword'),
        database: config.get<string>('DB_NAME', 'product_db'),
        entities: [
          UserEntity,
          ProductEntity,
          OrderEntity,
          OrderItemEntity,
          InventoryLogEntity,
        ],
        synchronize: false,
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    RedisModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    InventoryModule,
  ],
})
export class AppModule {}
