import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  // Safe lock release Lua script (only releases if the value matches the caller's UUID)
  private readonly releaseLockScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', '127.0.0.1');
    const port = this.configService.get<number>('REDIS_PORT', 6379);

    this.client = new Redis({
      host,
      port,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to Redis at ${host}:${port}`);
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis Error: ${err.message}`, err.stack);
    });
  }

  getClient(): Redis {
    return this.client;
  }

  /**
   * Acquire a distributed lock with automatic expiration TTL
   */
  async acquireLock(key: string, ttlMs = 10000): Promise<string | null> {
    const lockValue = randomUUID();
    const lockKey = `lock:${key}`;
    const result = await this.client.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
    return result === 'OK' ? lockValue : null;
  }

  /**
   * Release a distributed lock safely using Lua script
   */
  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    try {
      const result = await this.client.eval(
        this.releaseLockScript,
        1,
        lockKey,
        lockValue,
      );
      return result === 1;
    } catch (err) {
      this.logger.error(`Failed to release lock for ${lockKey}`, err);
      return false;
    }
  }

  /**
   * Idempotency cache lookup
   */
  async getIdempotencyRecord<T = any>(key: string): Promise<T | null> {
    const data = await this.client.get(`idempotency:${key}`);
    return data ? (JSON.parse(data) as T) : null;
  }

  /**
   * Store response for Idempotency Key
   */
  async setIdempotencyRecord(
    key: string,
    value: any,
    ttlSeconds = 86400,
  ): Promise<void> {
    await this.client.set(
      `idempotency:${key}`,
      JSON.stringify(value),
      'EX',
      ttlSeconds,
    );
  }

  async onModuleDestroy() {
    this.logger.log('Closing Redis connection...');
    await this.client.quit();
  }
}
