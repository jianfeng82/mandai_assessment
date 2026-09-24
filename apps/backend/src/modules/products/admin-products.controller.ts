import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserEntity, UserRole } from '../auth/entities/user.entity';

@ApiTags('Admin Catalog & Stock')
@ApiBearerAuth('JWT-auth')
@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all products including inactive (Admin only)',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'All products returned' })
  async getAllProducts(@Query('search') search?: string) {
    return this.productsService.findAll(false, search);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new product in the catalog (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Product created and initial stock logged',
  })
  async createProduct(@Body() createDto: CreateProductDto) {
    return this.productsService.create(createDto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update product title, price, description or active status',
  })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  async updateProduct(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateDto);
  }

  @Post(':id/stock')
  @ApiOperation({
    summary: 'Restock or adjust product inventory with audit logging',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock adjusted and immutable audit log created',
  })
  async adjustStock(
    @Param('id') id: string,
    @Body() adjustDto: AdjustStockDto,
    @CurrentUser() admin: UserEntity,
  ) {
    return this.productsService.adjustStock(
      id,
      adjustDto.amount,
      admin.id,
      adjustDto.reason,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete / deactivate a product (Admin only)' })
  @ApiResponse({ status: 200, description: 'Product deactivated' })
  async deleteProduct(@Param('id') id: string) {
    return this.productsService.delete(id);
  }
}
