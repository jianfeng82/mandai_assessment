import { Inject } from '@nestjs/common';
import { DatabaseManager } from '../core/database/database-manager.service';
import { LoggerService } from './logger/logger.service';

/**
 * Base Repository injecting DatabaseManager and LoggerService.
 */
export abstract class BaseRepository {
  @Inject(DatabaseManager)
  protected readonly dbManager: DatabaseManager;

  @Inject(LoggerService)
  protected readonly logger: LoggerService;
}
