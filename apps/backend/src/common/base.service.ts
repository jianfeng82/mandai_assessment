import { Inject } from '@nestjs/common';
import { DatabaseManager } from '../core/database/database-manager.service';
import { LoggerService } from './logger/logger.service';
import { RedisService } from '../modules/redis/redis.service';

/**
 * Base Service injecting DatabaseManager, LoggerService, and RedisService.
 * Directly adapted from valkyrie-nodejs (src/common/base.service.ts).
 */
export abstract class BaseService {
  @Inject(DatabaseManager)
  protected readonly dbManager: DatabaseManager;

  @Inject(LoggerService)
  protected readonly logger: LoggerService;

  @Inject(RedisService)
  protected readonly redisService: RedisService;
}
