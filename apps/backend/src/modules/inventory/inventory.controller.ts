import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@ApiTags('Admin Audit Ledger')
@ApiBearerAuth('JWT-auth')
@Controller('admin/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('logs')
  @ApiOperation({
    summary: 'Retrieve immutable inventory audit logs (Admin only)',
  })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Audit log entries returned' })
  async getLogs(
    @Query('productId') productId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.getLogs(productId, limit ? Number(limit) : 50);
  }
}
