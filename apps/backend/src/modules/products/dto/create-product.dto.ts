import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateProductSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    price_cents: z.number().int().min(0, 'Price must be non-negative'),
    stock: z.number().int().min(0, 'Stock must be non-negative'),
    is_active: z.boolean().optional(),
  })
  .strict();

export class CreateProductDto extends createZodDto(CreateProductSchema) {}
