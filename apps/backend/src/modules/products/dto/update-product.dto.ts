import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateProductSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    price_cents: z.number().int().min(0).optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

export class UpdateProductDto extends createZodDto(UpdateProductSchema) {}
