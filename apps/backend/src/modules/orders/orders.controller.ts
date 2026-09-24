import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { OrdersService, BuyReceipt } from './orders.service';
import { BuyProductDto } from './dto/buy-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserEntity } from '../auth/entities/user.entity';

@ApiTags('Customer Orders & Buy')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('buy')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Atomic purchase endpoint with strict anti-overselling logic',
    description:
      'Guarantees zero race conditions via MySQL Atomic Conditional Update (WHERE stock >= :qty) wrapped in ACID transaction, with Redis idempotency check and user-level lock.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Unique UUID to prevent duplicate submissions on network retry',
  })
  @ApiResponse({
    status: 201,
    description: 'Order created and stock successfully reserved',
  })
  @ApiResponse({
    status: 409,
    description: 'Out of stock or concurrent order in progress',
  })
  async buy(
    @CurrentUser() user: UserEntity,
    @Body() buyDto: BuyProductDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<BuyReceipt> {
    return this.ordersService.buy(user.id, buyDto, idempotencyKey);
  }

  @Get('my-orders')
  @ApiOperation({
    summary: 'Get current customer purchase history with line items',
  })
  @ApiResponse({ status: 200, description: 'List of past orders' })
  async getMyOrders(@CurrentUser() user: UserEntity) {
    return this.ordersService.getMyOrders(user.id);
  }
}
