import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const BuyProductSchema = z
  .object({
    productId: z.string().min(1, 'Product ID is required'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').default(1),
  })
  .strict();

export class BuyProductDto extends createZodDto(BuyProductSchema) {}
