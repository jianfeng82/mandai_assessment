import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';

@ApiTags('Storefront Catalog')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List all active products in stock' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Filter by title or description',
  })
  @ApiResponse({ status: 200, description: 'List of active products returned' })
  async getProducts(@Query('search') search?: string) {
    return this.productsService.findAll(true, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single product details by ID' })
  @ApiResponse({ status: 200, description: 'Product details returned' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProduct(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }
}
