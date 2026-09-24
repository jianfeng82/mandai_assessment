import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { randomUUID } from 'crypto';
import { RedisService } from '../../modules/redis/redis.service';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * Pessimistic Distributed Lock on a per-user basis using Redis.
 */
@Injectable()
export class UserLockInterceptor implements NestInterceptor {
  private readonly releaseLockScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
    else
        return 0
    end
  `;

  constructor(
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<
      Request & {
        user?: { id?: string; userId?: string };
      }
    >();

    const userId = request.user?.id || request.user?.userId;

    if (!userId) {
      this.logger.warn(
        'UserLockInterceptor used on a route without authenticated userId',
        'UserLockInterceptor',
      );
      return next.handle();
    }

    const lockKey = `lock:user:${userId}`;
    const lockValue = randomUUID();
    const ttlMs = 15000; // 15 seconds max safety timeout

    const redis = this.redisService.getClient();
    const acquired = await redis.set(lockKey, lockValue, 'PX', ttlMs, 'NX');

    if (!acquired) {
      this.logger.warn(
        `User ${userId} has a concurrent action in progress. Rejecting.`,
        'UserLockInterceptor',
      );
      throw new ConflictException(
        'Concurrent order in progress. Please wait a moment.',
      );
    }

    return next.handle().pipe(
      finalize(() => {
        void (async () => {
          try {
            await redis.eval(this.releaseLockScript, 1, lockKey, lockValue);
          } catch (error) {
            this.logger.error(
              `Failed to release distributed lock for ${userId}`,
              error instanceof Error ? error.stack : String(error),
              'UserLockInterceptor',
            );
          }
        })();
      }),
    );
  }
}
