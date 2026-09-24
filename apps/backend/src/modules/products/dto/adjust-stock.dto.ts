import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const AdjustStockSchema = z
  .object({
    amount: z.number().int(),
    reason: z.string().optional(),
  })
  .strict();

export class AdjustStockDto extends createZodDto(AdjustStockSchema) {}
