import { Inject } from '@nestjs/common';
import { DatabaseManager } from '../core/database/database-manager.service';
import { LoggerService } from './logger/logger.service';

/**
 * Base Repository injecting DatabaseManager and LoggerService.
 * Directly adapted from valkyrie-nodejs (src/common/base.repository.ts).
 */
export abstract class BaseRepository {
  @Inject(DatabaseManager)
  protected readonly dbManager: DatabaseManager;

  @Inject(LoggerService)
  protected readonly logger: LoggerService;
}
